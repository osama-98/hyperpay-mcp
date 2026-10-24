// SQLite storage: full-text search index, page records (with hashes), result codes.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { IndexSummary, PageRecord, ResultCode, SearchHit, Source } from "./types.js";

// "../data/" works from both src/ (dev) and dist/ (built). data/ is mounted in Docker.
const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(dataDir + "docs.db");

// WAL lets readers (MCP requests) and the writer (indexer) work at the same time.
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    path          TEXT PRIMARY KEY,
    url           TEXT NOT NULL,
    title         TEXT NOT NULL,
    source        TEXT NOT NULL,
    hash          TEXT NOT NULL,
    text          TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    changed_at    TEXT,
    fetched_at    TEXT NOT NULL
  );

  -- fts5 = full-text search. porter = stemming ("refunds" finds "refund").
  -- path is UNINDEXED: stored for joining, not searched.
  CREATE VIRTUAL TABLE IF NOT EXISTS sections USING fts5(
    path UNINDEXED, page_title, heading, body,
    tokenize = 'porter unicode61'
  );

  -- One meaning-vector per section (section_id = sections.rowid).
  -- vector = 384 float32 numbers stored as raw bytes (BLOB).
  CREATE TABLE IF NOT EXISTS embeddings (
    section_id INTEGER PRIMARY KEY,
    path       TEXT NOT NULL,
    vector     BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS result_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// node:sqlite returns loosely typed rows; this is the one place we assert their shape.
const rows = <T>(value: unknown) => value as T;

/** Run fn inside a transaction: all of its writes are saved together, or none. */
function transaction(fn: () => void): void {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

const PAGE_COLUMNS = `path, url, title, source, hash, text,
  first_seen_at AS firstSeenAt, changed_at AS changedAt, fetched_at AS fetchedAt`;

export function getPage(path: string): PageRecord | undefined {
  return rows<PageRecord | undefined>(db.prepare(`SELECT ${PAGE_COLUMNS} FROM pages WHERE path = ?`).get(path));
}

export function listPages(source?: Source): PageRecord[] {
  const sql = `SELECT ${PAGE_COLUMNS} FROM pages ${source ? "WHERE source = ?" : ""} ORDER BY path`;
  return rows<PageRecord[]>(source ? db.prepare(sql).all(source) : db.prepare(sql).all());
}

export type SaveStatus = "new" | "changed" | "unchanged";

/**
 * Store a page and its sections. The hash decides what happened:
 * no row yet = new, different hash = changed (records changed_at), same hash = unchanged.
 */
export function savePage(
  page: { path: string; url: string; title: string; source: Source; text: string },
  sections: { heading: string; body: string }[],
  now: string
): SaveStatus {
  const hash = createHash("sha256").update(page.text).digest("hex");
  const existing = getPage(page.path);
  const status: SaveStatus = !existing ? "new" : existing.hash === hash ? "unchanged" : "changed";

  transaction(() => {
    if (status === "new") {
      db.prepare(
        `INSERT INTO pages (path, url, title, source, hash, text, first_seen_at, changed_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
      ).run(page.path, page.url, page.title, page.source, hash, page.text, now, now);
    } else if (status === "changed") {
      db.prepare(
        `UPDATE pages SET url = ?, title = ?, hash = ?, text = ?, changed_at = ?, fetched_at = ? WHERE path = ?`
      ).run(page.url, page.title, hash, page.text, now, now, page.path);
    } else {
      db.prepare("UPDATE pages SET fetched_at = ? WHERE path = ?").run(now, page.path);
    }

    if (status !== "unchanged") {
      // Old sections and their vectors go together; the indexer embeds the new ones.
      db.prepare("DELETE FROM embeddings WHERE path = ?").run(page.path);
      db.prepare("DELETE FROM sections WHERE path = ?").run(page.path);
      const insert = db.prepare("INSERT INTO sections (path, page_title, heading, body) VALUES (?, ?, ?, ?)");
      for (const s of sections) insert.run(page.path, page.title, s.heading, s.body);
    }
  });
  return status;
}

/** Delete pages of a source that no longer exist (e.g. removed from the docs sidebar). */
export function removePagesExcept(source: Source, keep: Set<string>): number {
  const gone = listPages(source).filter((p) => !keep.has(p.path));
  transaction(() => {
    for (const p of gone) {
      db.prepare("DELETE FROM embeddings WHERE path = ?").run(p.path);
      db.prepare("DELETE FROM sections WHERE path = ?").run(p.path);
      db.prepare("DELETE FROM pages WHERE path = ?").run(p.path);
    }
  });
  return gone.length;
}

/**
 * Full-text search. Turns free text into an FTS query: each word quoted (so
 * characters like "-" or ":" can't break the query syntax), joined with OR.
 * bm25 ranks the best matches first; a heading match weighs more than body text.
 */
export function searchSections(query: string, source: Source | null, limit: number): SearchHit[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  if (words.length === 0) return [];
  const match = words.map((w) => `"${w}"`).join(" OR ");

  return rows<SearchHit[]>(
    db
      .prepare(
        `SELECT ${HIT_COLUMNS}
         FROM sections JOIN pages ON pages.path = sections.path
         WHERE sections MATCH ? AND (? IS NULL OR pages.source = ?)
         ORDER BY bm25(sections, 0, 2.0, 3.0, 1.0)
         LIMIT ?`
      )
      .all(match, source, source, limit)
  );
}

const HIT_COLUMNS = `sections.rowid AS id, sections.path, sections.heading, sections.body,
  pages.title AS pageTitle, pages.url, pages.source, pages.fetched_at AS fetchedAt`;

/** Load search hits by section id (used for semantic results). */
export function getSections(ids: number[]): SearchHit[] {
  if (ids.length === 0) return [];
  return rows<SearchHit[]>(
    db
      .prepare(
        `SELECT ${HIT_COLUMNS} FROM sections JOIN pages ON pages.path = sections.path
         WHERE sections.rowid IN (${ids.map(() => "?").join(",")})`
      )
      .all(...ids)
  );
}

/** Sections that have no vector yet: new or changed pages, or an index from before embeddings. */
export function sectionsWithoutEmbedding(): { id: number; path: string; text: string }[] {
  return rows<{ id: number; path: string; text: string }[]>(
    db
      .prepare(
        `SELECT sections.rowid AS id, sections.path,
                sections.page_title || ' > ' || sections.heading || char(10) || sections.body AS text
         FROM sections LEFT JOIN embeddings ON embeddings.section_id = sections.rowid
         WHERE embeddings.section_id IS NULL`
      )
      .all()
  );
}

export function saveEmbeddings(items: { id: number; path: string; vector: Float32Array }[]): void {
  transaction(() => {
    const insert = db.prepare("INSERT OR REPLACE INTO embeddings (section_id, path, vector) VALUES (?, ?, ?)");
    for (const item of items) {
      // Store the float32 numbers as their raw bytes.
      insert.run(item.id, item.path, new Uint8Array(item.vector.buffer, item.vector.byteOffset, item.vector.byteLength));
    }
  });
}

/** All vectors (optionally of one source), for comparing against a question. */
export function listEmbeddings(source: Source | null): { id: number; vector: Float32Array }[] {
  const all = rows<{ id: number; vector: Uint8Array }[]>(
    db
      .prepare(
        `SELECT embeddings.section_id AS id, embeddings.vector FROM embeddings
         JOIN pages ON pages.path = embeddings.path
         WHERE ? IS NULL OR pages.source = ?`
      )
      .all(source, source)
  );
  // Read the bytes back as float32 numbers (a view, no copy).
  return all.map((row) => ({
    id: row.id,
    vector: new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4),
  }));
}

export function countEmbeddings(): { sections: number; embedded: number } {
  return rows<{ sections: number; embedded: number }>(
    db.prepare("SELECT (SELECT count(*) FROM sections) AS sections, (SELECT count(*) FROM embeddings) AS embedded").get()
  );
}

export function replaceResultCodes(codes: ResultCode[]): void {
  transaction(() => {
    db.exec("DELETE FROM result_codes");
    const insert = db.prepare("INSERT INTO result_codes (code, description) VALUES (?, ?)");
    for (const c of codes) insert.run(c.code, c.description);
  });
}

export function getResultCode(code: string): ResultCode | undefined {
  return rows<ResultCode | undefined>(db.prepare("SELECT code, description FROM result_codes WHERE code = ?").get(code));
}

export function countResultCodes(): number {
  return rows<{ n: number }>(db.prepare("SELECT count(*) AS n FROM result_codes").get()).n;
}

export function saveLastRun(summary: IndexSummary): void {
  db.prepare("INSERT INTO meta (key, value) VALUES ('last_run', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(summary)
  );
}

export function getLastRun(): IndexSummary | undefined {
  const row = rows<{ value: string } | undefined>(db.prepare("SELECT value FROM meta WHERE key = 'last_run'").get());
  return row ? (JSON.parse(row.value) as IndexSummary) : undefined;
}

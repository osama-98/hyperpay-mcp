// Fetches the HyperPay docs + official result codes, reads the skill files,
// and fills the search index. Run on a schedule by mcp.ts, or once with `npm run index`.
import * as cheerio from "cheerio";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { BASE_URL, MIN_EXPECTED_PAGES, RESULT_CODES_URL, START_PATH, discoverPaths } from "./pages.js";
import {
  getLastRun,
  removePagesExcept,
  replaceResultCodes,
  saveEmbeddings,
  saveLastRun,
  savePage,
  sectionsWithoutEmbedding,
} from "./db.js";
import { embedDocuments } from "./embeddings.js";
import type { IndexSummary, ParsedPage } from "./types.js";

const USER_AGENT = "hyperpay-mcp-indexer/1.0 (local documentation index)";
const DELAY_MS = 1000; // 1 request per second: be polite to their server
const knowledgeDir = fileURLToPath(new URL("../knowledge/", import.meta.url));

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Join lines, collapse spaces, drop empty lines. */
const clean = (s: string) =>
  s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

const CHUNK_CHARS = 1500;

/**
 * Split long sections into ~1500-char chunks at line breaks ("Heading (part 2)").
 * Small hits keep the matching text inside what search returns.
 */
export function chunkSections(sections: { heading: string; body: string }[]): { heading: string; body: string }[] {
  return sections.flatMap((section) => {
    if (section.body.length <= CHUNK_CHARS) return [section];
    const chunks: string[] = [];
    let current = "";
    for (const line of section.body.split("\n")) {
      if (current && current.length + line.length > CHUNK_CHARS) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + line;
    }
    if (current) chunks.push(current);
    return chunks.map((body, i) => ({ heading: i === 0 ? section.heading : `${section.heading} (part ${i + 1})`, body }));
  });
}

/** Extract the article text of a docs page and split it at its h2/h3 headings. */
export function parseDocPage(html: string): ParsedPage {
  const $ = cheerio.load(html);
  const article = $("article").first();
  if (article.length === 0) throw new Error("no <article> element: page layout changed?");

  article.find("script, style, nav, button, svg, noscript").remove();
  const title = clean(article.find("h1").first().text()) || $("title").text().replace(/\s*\|.*$/, "").trim();
  article.find("h1").remove();

  // Replace each h2/h3 with a marker line. .text() sets plain text, so heading
  // content can't be interpreted as HTML.
  const MARK = "@@SECTION@@";
  article.find("h2, h3").each((_, el) => {
    $(el).replaceWith($("<span>").text(`\n${MARK}${$(el).text().trim()}\n`));
  });
  // Line breaks after block elements, " | " between table cells.
  article.find("p, li, tr, pre, h4, h5, h6, div, dt, dd, br, table").after("\n");
  article.find("td, th").after(" | ");

  const [intro = "", ...parts] = article.text().split(MARK);
  const sections = [{ heading: title, body: clean(intro) }];
  for (const part of parts) {
    const newline = part.indexOf("\n");
    const heading = clean(newline === -1 ? part : part.slice(0, newline));
    sections.push({ heading, body: clean(newline === -1 ? "" : part.slice(newline + 1)) });
  }
  const nonEmpty = sections.filter((s) => s.body.length > 0);
  return {
    title,
    text: nonEmpty.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n"),
    sections: chunkSections(nonEmpty),
  };
}

/** Split a markdown skill file at its ## / ### headings. */
export function parseSkillFile(markdown: string, fallbackTitle: string): ParsedPage {
  const title = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? fallbackTitle;
  const sections: { heading: string; body: string }[] = [];
  let heading = title;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join("\n").trim();
    if (body) sections.push({ heading, body });
  };
  for (const line of markdown.split("\n")) {
    const h = line.match(/^#{2,3} (.+)$/);
    if (h?.[1]) {
      flush();
      heading = h[1].trim();
      lines = [];
    } else if (!line.startsWith("# ")) {
      lines.push(line);
    }
  }
  flush();
  return { title, text: markdown, sections: chunkSections(sections) };
}

/** All .md files under knowledge/, as paths like "references/webhooks.md". */
function listSkillFiles(): string[] {
  return readdirSync(knowledgeDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replaceAll("\\", "/"))
    .sort();
}

const ResultCodesResponse = z.object({
  resultCodes: z.array(z.object({ code: z.string(), description: z.string() })).min(100),
});

let running: Promise<IndexSummary> | null = null;

/** Run one full index. Concurrent callers share the same run instead of starting a second. */
export function runIndex(log: (msg: string) => void = console.error): Promise<IndexSummary> {
  running ??= indexOnce(log).finally(() => {
    running = null;
  });
  return running;
}

export const isIndexing = () => running !== null;

async function indexOnce(log: (msg: string) => void): Promise<IndexSummary> {
  const startedAt = new Date().toISOString();
  const docs: IndexSummary["docs"] = { new: 0, changed: 0, unchanged: 0, removed: 0, failed: [] };

  // 1. Discover pages from the sidebar. Too few = site changed: abort, keep the old index.
  const paths = discoverPaths(await fetchText(BASE_URL + START_PATH));
  if (paths.length < MIN_EXPECTED_PAGES) {
    throw new Error(`only ${paths.length} pages discovered (expected >= ${MIN_EXPECTED_PAGES}); keeping old index`);
  }
  log(`indexing ${paths.length} docs pages...`);

  // 2. Fetch and store each page. One failure doesn't stop the run; the old copy stays.
  for (const path of paths) {
    try {
      const parsed = parseDocPage(await fetchText(BASE_URL + path));
      const status = savePage(
        { path, url: BASE_URL + path, title: parsed.title, source: "docs", text: parsed.text },
        parsed.sections,
        new Date().toISOString()
      );
      docs[status]++;
      if (status !== "unchanged") log(`  ${status}: ${path}`);
    } catch (err) {
      docs.failed.push(`${path}: ${(err as Error).message}`);
      log(`  FAILED ${path}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }
  docs.removed = removePagesExcept("docs", new Set(paths));

  // 3. Skill files: indexed too, and hashed, so editing one counts as "updated".
  const skillFiles = listSkillFiles();
  for (const file of skillFiles) {
    const parsed = parseSkillFile(readFileSync(knowledgeDir + file, "utf8"), file);
    savePage(
      { path: `skill/${file}`, url: "", title: parsed.title, source: "skill", text: parsed.text },
      parsed.sections,
      new Date().toISOString()
    );
  }
  removePagesExcept("skill", new Set(skillFiles.map((f) => `skill/${f}`)));

  // 4. Official result codes. zod checks the shape before we replace the table.
  const codes = ResultCodesResponse.parse(JSON.parse(await fetchText(RESULT_CODES_URL))).resultCodes;
  replaceResultCodes(codes);

  // 5. Embed every section without a vector (new or changed pages only).
  //    A failure here keeps keyword search working; the next run retries.
  let embedded = 0;
  try {
    embedded = await embedMissing(log);
  } catch (err) {
    log(`embedding failed, keyword search still works: ${(err as Error).message}`);
  }

  const summary: IndexSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    docs,
    skillFiles: skillFiles.length,
    resultCodes: codes.length,
    embedded,
  };
  saveLastRun(summary);
  log(`done: ${JSON.stringify(summary)}`);
  return summary;
}

/** Embed sections that have no vector yet, saving in batches so progress survives a crash. */
async function embedMissing(log: (msg: string) => void): Promise<number> {
  const missing = sectionsWithoutEmbedding();
  if (missing.length === 0) return 0;
  log(`embedding ${missing.length} sections...`);
  const started = Date.now();
  const SAVE_EVERY = 128;
  for (let i = 0; i < missing.length; i += SAVE_EVERY) {
    const batch = missing.slice(i, i + SAVE_EVERY);
    const vectors = await embedDocuments(batch.map((s) => s.text));
    saveEmbeddings(batch.map((s, j) => ({ id: s.id, path: s.path, vector: vectors[j]! })));
  }
  log(`embedded ${missing.length} sections in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return missing.length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Index if there was never a successful run, or the last one is older than a day. */
export async function indexIfStale(log: (msg: string) => void = console.error): Promise<void> {
  const last = getLastRun();
  if (last && Date.now() - Date.parse(last.finishedAt) < DAY_MS) return;
  try {
    await runIndex(log);
  } catch (err) {
    log(`index run failed: ${(err as Error).message}`);
  }
}

// `npm run index`: run once when this file is executed directly (not imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runIndex(console.log).catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}

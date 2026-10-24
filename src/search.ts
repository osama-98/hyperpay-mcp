// Hybrid search: keyword (BM25) + meaning (embeddings), merged with Reciprocal Rank Fusion.
// Keyword wins on exact terms (onBeforeSubmitCard, 000.200.100); meaning wins on
// different words for the same idea ("void" vs "reversal"). Together beats either alone.
import { getSections, listEmbeddings, searchSections } from "./db.js";
import { cosine, embedQuery } from "./embeddings.js";
import type { SearchHit, Source } from "./types.js";

const CANDIDATES = 30; // how many results each method contributes before merging
const RRF_K = 60; // standard RRF constant: damps the gap between rank 1 and rank 2

export async function hybridSearch(query: string, source: Source | null, limit: number): Promise<SearchHit[]> {
  const keywordIds = searchSections(query, source, CANDIDATES).map((hit) => hit.id);
  // If the model fails, fall back to keyword-only instead of failing the search.
  const semanticIds = await semanticSearch(query, source).catch((err: unknown) => {
    console.error(`semantic search failed, using keyword only: ${(err as Error).message}`);
    return [];
  });

  // RRF: each list gives a section 1/(60 + rank). Sections ranked high in both lists win.
  const scores = new Map<number, number>();
  for (const ids of [keywordIds, semanticIds]) {
    ids.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1)));
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const hits = new Map(getSections(ranked).map((hit) => [hit.id, hit]));
  return dedupe(ranked.map((id) => hits.get(id)).filter((hit): hit is SearchHit => !!hit)).slice(0, limit);
}

/** Section ids ordered by meaning-similarity to the query. Empty if nothing is embedded yet. */
async function semanticSearch(query: string, source: Source | null): Promise<number[]> {
  const vectors = listEmbeddings(source);
  if (vectors.length === 0) return [];
  const queryVector = await embedQuery(query);
  return vectors
    .map(({ id, vector }) => ({ id, score: cosine(queryVector, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES)
    .map(({ id }) => id);
}

/** Drop hits whose text is identical to a better-ranked one (HyperPay publishes some pages twice). */
function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.heading}\n${hit.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

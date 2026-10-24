// Shared data shapes. Every file imports these, so all agree on what the data looks like.

/** Where a page came from: the live HyperPay docs, or the copied skill files. */
export type Source = "docs" | "skill";

/** One indexed page (a docs page or a skill file). */
export interface PageRecord {
  path: string; // "/reference/workflows" or "skill/references/webhooks.md"
  url: string; // full URL for docs pages, empty for skill files
  title: string;
  source: Source;
  hash: string; // sha256 of the text: changes when the page content changes
  text: string;
  firstSeenAt: string; // ISO timestamps
  changedAt: string | null; // null = unchanged since first seen
  fetchedAt: string;
}

/** A page split at its headings, so search can return just the matching part. */
export interface ParsedPage {
  title: string;
  text: string;
  sections: { heading: string; body: string }[];
}

/** One search hit: a section plus the page it belongs to. */
export interface SearchHit {
  id: number; // section id: links keyword hits, semantic hits and vectors
  path: string;
  heading: string;
  body: string;
  pageTitle: string;
  url: string;
  source: Source;
  fetchedAt: string;
}

export interface ResultCode {
  code: string;
  description: string;
}

/** Outcome of one indexer run, stored so index_status can report it. */
export interface IndexSummary {
  startedAt: string;
  finishedAt: string;
  docs: { new: number; changed: number; unchanged: number; removed: number; failed: string[] };
  skillFiles: number;
  resultCodes: number;
  embedded: number; // sections embedded in this run (only new/changed ones)
}

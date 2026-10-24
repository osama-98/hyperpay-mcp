// Stale-skill detection. Each skill file lists the docs pages it was written
// from ("Source: https://hyperpay.docs.oppwa.com/..."). If one of those pages
// changed after the skill file was last updated, the skill may be outdated.
import { BASE_URL } from "./pages.js";
import { getPage, listPages } from "./db.js";
import type { PageRecord } from "./types.js";

export interface StaleSkill {
  file: string; // "skill/references/webhooks.md"
  changedSources: { path: string; changedAt: string }[];
}

/** Docs paths listed as sources in a skill file's header (before its first ## heading). */
function sourcePaths(skill: PageRecord): string[] {
  const header = skill.text.split(/^## /m)[0] ?? "";
  const escaped = BASE_URL.replace(/[.]/g, "\\.");
  const matches = header.matchAll(new RegExp(`${escaped}(/[^\\s)]+)`, "g"));
  return [...matches].map((m) => (m[1] ?? "").split("#")[0] ?? "").filter(Boolean);
}

/** When this skill file was last written: its own change date, or when first indexed. */
const skillBaseline = (skill: PageRecord) => skill.changedAt ?? skill.firstSeenAt;

export function checkSkill(skill: PageRecord): StaleSkill | undefined {
  const changedSources = sourcePaths(skill)
    .map((path) => getPage(path))
    .filter((page): page is PageRecord => !!page?.changedAt && page.changedAt > skillBaseline(skill))
    .map((page) => ({ path: page.path, changedAt: page.changedAt! }));
  return changedSources.length ? { file: skill.path, changedSources } : undefined;
}

export function staleSkills(): StaleSkill[] {
  return listPages("skill")
    .map(checkSkill)
    .filter((s): s is StaleSkill => s !== undefined);
}

/** One-line warning for a stale skill file, or "" when it is up to date. */
export function staleWarning(skillPath: string): string {
  const skill = getPage(skillPath);
  const stale = skill && checkSkill(skill);
  if (!stale) return "";
  const list = stale.changedSources.map((s) => `${s.path} (${s.changedAt.slice(0, 10)})`).join(", ");
  return `WARNING: this skill file may be outdated; its source page changed since: ${list}. Prefer the docs.`;
}

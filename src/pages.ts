// Which docs pages to index. Read from the docs sidebar on every run, so new
// pages are picked up automatically (a fixed list would go stale).
import * as cheerio from "cheerio";

export const BASE_URL = "https://hyperpay.docs.oppwa.com";
export const RESULT_CODES_URL = "https://eu-test.oppwa.com/v1/resultcodes";

/** Any docs page works as a start: every page carries the full sidebar. */
export const START_PATH = "/reference/workflows";

/** If discovery finds fewer pages than this, the site changed shape: stop, keep the old index. */
export const MIN_EXPECTED_PAGES = 20;

const DOC_PATH = /^\/(reference|integrations|tutorials|support)(\/|$)/;
// Mobile SDK pages are app-side; out of scope for backend integration.
const EXCLUDED = [/^\/integrations\/mobile-sdk/, /^\/tutorials\/mobile-sdk/];

/** Collect unique docs paths from a page's links, without #anchors. */
export function discoverPaths(html: string): string[] {
  const $ = cheerio.load(html);
  const paths = new Set<string>([START_PATH]);
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").replace(BASE_URL, "").split("#")[0] ?? "";
    if (DOC_PATH.test(href) && !EXCLUDED.some((re) => re.test(href))) {
      paths.add(href.replace(/\/$/, ""));
    }
  });
  return [...paths].sort();
}

import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/categories";
import type { PostSummary } from "@/lib/queries/posts";

// /blog filters (spec §6.2). Pure, so the client filters the static post list
// and the URL query (?cat=&tag=&year=&time=&q=) is the only state.

export const READING_TIMES = ["short", "mid", "long"] as const;
export type ReadingTime = (typeof READING_TIMES)[number];

export type BlogQuery = {
  cat?: BlogCategory;
  tag?: string;
  year?: string;
  time?: ReadingTime;
  q?: string;
};

/** Chip labels, in display order. */
export const READING_TIME_LABELS: Record<ReadingTime, string> = {
  short: "Under 5 min",
  mid: "5–10 min",
  long: "10+ min",
};

const isCategory = (v: string): v is BlogCategory => (BLOG_CATEGORIES as readonly string[]).includes(v);
const isTime = (v: string): v is ReadingTime => (READING_TIMES as readonly string[]).includes(v);

/** Reads the URL query. Invalid or empty values are dropped. */
export function parseBlogQuery(sp: URLSearchParams): BlogQuery {
  const out: BlogQuery = {};
  const cat = sp.get("cat");
  if (cat && isCategory(cat)) out.cat = cat;
  const tag = sp.get("tag")?.trim();
  if (tag) out.tag = tag;
  const year = sp.get("year");
  if (year && /^\d{4}$/.test(year)) out.year = year;
  const time = sp.get("time");
  if (time && isTime(time)) out.time = time;
  const q = sp.get("q")?.trim();
  if (q) out.q = q;
  return out;
}

const KEYS = ["cat", "tag", "year", "time", "q"] as const;

/** "?cat=Statistics&tag=statistics" (fixed key order), or "" when nothing is set. */
export function blogQueryString(q: BlogQuery): string {
  const sp = new URLSearchParams();
  for (const key of KEYS) {
    const v = q[key];
    if (v) sp.set(key, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function fitsTime(minutes: number, time: ReadingTime): boolean {
  if (time === "short") return minutes < 5;
  if (time === "mid") return minutes >= 5 && minutes <= 10;
  return minutes > 10;
}

/** All set filters must match. `q` searches title + excerpt, case-insensitively. */
export function filterPosts(posts: PostSummary[], q: BlogQuery): PostSummary[] {
  const needle = q.q?.trim().toLowerCase();
  return posts.filter(
    (p) =>
      (!q.cat || p.category === q.cat) &&
      (!q.tag || p.tags.includes(q.tag)) &&
      (!q.year || p.year === q.year) &&
      (!q.time || fitsTime(p.readingMinutes, q.time)) &&
      (!needle || `${p.title}\n${p.excerpt}`.toLowerCase().includes(needle)),
  );
}

/** True when any filter is set. */
export const hasFilters = (q: BlogQuery) => KEYS.some((k) => Boolean(q[k]));

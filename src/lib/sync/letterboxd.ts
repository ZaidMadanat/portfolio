import { XMLParser } from "fast-xml-parser";
import type { PrismaClient } from "@/generated/prisma/client";
import { db as prisma } from "@/lib/db";
import { starsToTen } from "@/lib/rating";
import { revalidateFor } from "@/lib/revalidate";

// Letterboxd diary → FilmLog (spec §8, §9.1). The public RSS feed holds about
// the last 50 diary entries; each is one item, a watch or a review, keyed by
// its guid. Older logs stay in the DB, so nothing is ever deleted here.

export const LETTERBOXD_USER_AGENT = "zaidmadanat.com sync (+https://zaidmadanat.com)";
const TIMEOUT_MS = 15_000;
const DEFAULT_USER = "itsMaday";

export type FilmLogInput = {
  letterboxdGuid: string;
  entryType: "WATCH" | "REVIEW";
  title: string;
  year: number;
  tmdbId: number | null;
  /** 0.5–5; null when the item has no memberRating (unrated). */
  stars: number | null;
  /** stars × 2 (starsToTen); null when unrated. */
  rating: number | null;
  /** The diary day at UTC midnight (FilmLog.watchedAt is a calendar date). */
  watchedAt: Date;
  posterUrl: string | null;
  rewatch: boolean;
  liked: boolean;
  hasLetterboxdReview: boolean;
  url: string;
};

const ENTRY_PREFIXES = { "letterboxd-watch-": "WATCH", "letterboxd-review-": "REVIEW" } as const;

// Namespace prefixes are kept (`letterboxd:filmTitle`, `tmdb:movieId`), values
// stay strings (parsed below), and `item` is always an array, even for one.
// Entities are decoded by `decodeXml` instead: the parser leaves numeric
// references (`&#039;`) alone, and decoding in one pass never decodes twice.
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: false,
  parseTagValue: false,
  processEntities: false,
  isArray: (name) => name === "item",
});

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** The five XML entities plus decimal/hex character references, in one pass. */
function decodeXml(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return NAMED[ref.toLowerCase()] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

type RawItem = Record<string, unknown>;

const text = (v: unknown): string | null => {
  if (typeof v === "string") return decodeXml(v).trim() || null;
  if (typeof v === "number") return String(v);
  return null;
};

const yes = (v: unknown) => text(v)?.toLowerCase() === "yes";

function entryTypeOf(guid: string): FilmLogInput["entryType"] | null {
  for (const [prefix, type] of Object.entries(ENTRY_PREFIXES)) if (guid.startsWith(prefix)) return type;
  return null;
}

/** "2026-10-28" → that day at UTC midnight; null if missing or not a real date. */
function diaryDay(v: unknown): Date | null {
  const s = text(v);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s) ? d : null;
}

function intOf(v: unknown): number | null {
  const s = text(v);
  return s && /^\d+$/.test(s) ? Number(s) : null;
}

function starsOf(v: unknown): number | null {
  const n = Number(text(v));
  return text(v) != null && Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

/** The first `<img src>` in the item's HTML description (CDATA), entity-decoded; https only. */
function posterOf(description: unknown): string | null {
  const html = typeof description === "string" ? description : "";
  const src = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!src) return null;
  const url = decodeXml(src).trim();
  return url.startsWith("https://") ? url : null;
}

/**
 * Parses the Letterboxd RSS feed into FilmLog rows. Diary items only: other
 * items (lists) are skipped silently. A diary item missing a required field
 * (filmYear, watchedDate, filmTitle or link) is skipped with a warning: the
 * row can't be stored without it, and the rest of the feed still syncs.
 * Throws if the document isn't an RSS feed at all.
 */
export function parseLetterboxd(xml: string): FilmLogInput[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem[] } | string } };
  const channel = doc.rss?.channel;
  if (channel == null) throw new Error("Letterboxd feed isn't RSS (no rss/channel)");
  const items = typeof channel === "object" ? (channel.item ?? []) : [];

  const out: FilmLogInput[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const guid = text(it.guid);
    const entryType = guid ? entryTypeOf(guid) : null;
    if (!guid || !entryType || seen.has(guid)) continue;

    const title = text(it["letterboxd:filmTitle"]);
    const year = intOf(it["letterboxd:filmYear"]);
    const watchedAt = diaryDay(it["letterboxd:watchedDate"]);
    const url = text(it.link);
    const missing = [!title && "filmTitle", year == null && "filmYear", !watchedAt && "watchedDate", !url && "link"]
      .filter(Boolean)
      .join(", ");
    if (missing) {
      console.warn(`Letterboxd: skipped ${guid}, missing or invalid ${missing}`);
      continue;
    }

    const stars = starsOf(it["letterboxd:memberRating"]);
    seen.add(guid);
    out.push({
      letterboxdGuid: guid,
      entryType,
      title: title!,
      year: year!,
      tmdbId: intOf(it["tmdb:movieId"]),
      stars,
      rating: starsToTen(stars),
      watchedAt: watchedAt!,
      posterUrl: posterOf(it.description),
      rewatch: yes(it["letterboxd:rewatch"]),
      liked: yes(it["letterboxd:memberLike"]),
      hasLetterboxdReview: entryType === "REVIEW",
      url: url!,
    });
  }
  return out;
}

export type LetterboxdDeps = {
  fetch: typeof globalThis.fetch;
  db: PrismaClient;
  /** Accepted for the shared sync signature (Task 32); this source doesn't need the clock. */
  now?: () => Date;
  /** Defaults to `revalidateFor('letterboxd')` (stale-while-revalidate, cron context). */
  revalidate?: () => void;
};

function feedUrl(): string {
  const user = process.env.LETTERBOXD_USER?.trim();
  return `https://letterboxd.com/${user && /^[A-Za-z0-9_]+$/.test(user) ? user : DEFAULT_USER}/rss/`;
}

type StoredLog = Omit<FilmLogInput, "stars"> & { stars: { toString(): string } | null };

function sameLog(row: StoredLog, item: FilmLogInput): boolean {
  return (
    row.entryType === item.entryType &&
    row.title === item.title &&
    row.year === item.year &&
    row.tmdbId === item.tmdbId &&
    (row.stars == null ? null : Number(row.stars.toString())) === item.stars &&
    row.rating === item.rating &&
    row.watchedAt.getTime() === item.watchedAt.getTime() &&
    row.posterUrl === item.posterUrl &&
    row.rewatch === item.rewatch &&
    row.liked === item.liked &&
    row.hasLetterboxdReview === item.hasLetterboxdReview &&
    row.url === item.url
  );
}

/**
 * Fetches the feed and upserts every diary item by guid. `itemsChanged` counts
 * the rows created or actually changed, so an identical second run reports 0.
 * It always revalidates the film tags, even when nothing changed or the fetch
 * failed: the film page's "this month" stats are baked in at render and would
 * go stale at a month rollover otherwise. Errors propagate (Task 32 logs them).
 */
export async function syncLetterboxd(
  deps: LetterboxdDeps = { fetch: globalThis.fetch, db: prisma },
): Promise<{ itemsChanged: number }> {
  const { fetch, db, revalidate = () => revalidateFor("letterboxd") } = deps;
  try {
    const res = await fetch(feedUrl(), {
      headers: { "User-Agent": LETTERBOXD_USER_AGENT, Accept: "application/rss+xml, application/xml;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Letterboxd RSS responded ${res.status}`);
    const items = parseLetterboxd(await res.text());

    const existing = await db.filmLog.findMany({
      where: { letterboxdGuid: { in: items.map((i) => i.letterboxdGuid) } },
    });
    const byGuid = new Map(existing.map((r) => [r.letterboxdGuid, r]));
    const changed = items.filter((i) => {
      const row = byGuid.get(i.letterboxdGuid);
      return !row || !sameLog(row, i);
    });

    if (changed.length) {
      await db.$transaction(
        changed.map(({ letterboxdGuid, ...data }) =>
          db.filmLog.upsert({ where: { letterboxdGuid }, create: { letterboxdGuid, ...data }, update: data }),
        ),
      );
    }
    return { itemsChanged: changed.length };
  } finally {
    revalidate();
  }
}

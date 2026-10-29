import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { db as prisma } from "@/lib/db";
import { revalidateFor } from "@/lib/revalidate";
import { SYNC_USER_AGENT, SyncShapeError } from "@/lib/sync/errors";

export { SyncShapeError };

// stats.fm top albums of the last 7 days → AlbumListen (spec §8, §9.1). The API
// is unofficial and unauthenticated. Each sync replaces the whole table, but
// only after the response parsed: any failure keeps last week's rows on the site.

const TIMEOUT_MS = 15_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_USER = "maday";
const VARIOUS = "Various Artists";

export type AlbumListenInput = {
  statsfmAlbumId: string;
  title: string;
  /** Artist names joined with ", "; "Various Artists" when stats.fm lists none. */
  artist: string;
  year: number | null;
  /** An https image URL, or "" (AlbumListen.coverUrl is required; queries map "" to null). */
  coverUrl: string;
  rank: number;
  streams: number;
};

/** `after = now − 7 days`, in milliseconds (spec §9.1: not `range=weeks`, which means 4 weeks). */
export function statsfmUrl(user: string, now: Date): string {
  const before = now.getTime();
  return `https://api.stats.fm/api/v1/users/${encodeURIComponent(user)}/top/albums?after=${before - WEEK_MS}&before=${before}&limit=6`;
}

// Only the fields we read; anything else in the response is ignored.
const responseSchema = z.object({
  items: z.array(
    z.object({
      position: z.number().int().positive(),
      streams: z.number().int().nonnegative(),
      album: z.object({
        id: z.union([z.number().int(), z.string().min(1)]),
        name: z.string().trim().min(1),
        image: z.string().nullish(),
        artists: z.array(z.object({ name: z.string() })).default([]),
        releaseDate: z.number().nullish(),
      }),
    }),
  ),
});

function artistLine(names: string[]): string {
  const all = names.map((n) => n.trim()).filter(Boolean);
  const real = all.filter((n) => n.toLowerCase() !== VARIOUS.toLowerCase());
  return (real.length ? real : [VARIOUS]).join(", ");
}

function releaseYear(ms: number | null | undefined): number | null {
  if (!ms) return null;
  const year = new Date(ms).getUTCFullYear();
  return Number.isFinite(year) && year > 1800 ? year : null;
}

const httpsOrEmpty = (url: string | null | undefined) => (url && /^https:\/\//.test(url) ? url : "");

/** Validates the response; throws `SyncShapeError` on anything unexpected. */
export function parseStatsfm(json: unknown): AlbumListenInput[] {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SyncShapeError("stats.fm", `${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  return parsed.data.items.map(({ position, streams, album }) => ({
    statsfmAlbumId: String(album.id),
    title: album.name,
    artist: artistLine(album.artists.map((a) => a.name)),
    year: releaseYear(album.releaseDate),
    coverUrl: httpsOrEmpty(album.image),
    rank: position,
    streams,
  }));
}

export type StatsfmDeps = {
  fetch: typeof globalThis.fetch;
  db: PrismaClient;
  now?: () => Date;
  /** Defaults to `revalidateFor('statsfm')` (stale-while-revalidate, cron context). */
  revalidate?: () => void;
};

function statsfmUser(): string {
  const user = process.env.STATSFM_USER?.trim();
  return user && /^[A-Za-z0-9_.-]+$/.test(user) ? user : DEFAULT_USER;
}

/**
 * Fetches last week's top albums and replaces every AlbumListen row in one
 * transaction, then revalidates `music` + `home`. A non-2xx, a network error,
 * a timeout or a bad shape throws before anything is written (Task 32 logs it).
 * An empty week is a successful answer: the table is emptied, so "On rotation
 * this week" hides (spec §6.7). Only failures keep the previous snapshot.
 * `itemsChanged` is the number of rows written, or of rows cleared for an empty week.
 */
export async function syncStatsfm(
  deps: StatsfmDeps = { fetch: globalThis.fetch, db: prisma },
): Promise<{ itemsChanged: number }> {
  const { fetch, db, now = () => new Date(), revalidate = () => revalidateFor("statsfm") } = deps;
  const windowEnd = now();
  const windowStart = new Date(windowEnd.getTime() - WEEK_MS);

  const res = await fetch(statsfmUrl(statsfmUser(), windowEnd), {
    headers: { "User-Agent": SYNC_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stats.fm responded ${res.status}`);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new SyncShapeError("stats.fm", "the body isn't JSON");
  }
  const albums = parseStatsfm(json);

  const [cleared] = await db.$transaction([
    db.albumListen.deleteMany(),
    db.albumListen.createMany({ data: albums.map((a) => ({ ...a, windowStart, windowEnd })) }),
  ]);
  revalidate();
  return { itemsChanged: albums.length > 0 ? albums.length : cleared.count };
}

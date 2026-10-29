import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { db as prisma } from "@/lib/db";
import { revalidateFor } from "@/lib/revalidate";
import { SYNC_USER_AGENT, SyncAuthError, SyncShapeError } from "@/lib/sync/errors";

export { SyncAuthError, SyncShapeError };

// Strava → StravaActivity (spec §6.1, §8, §9.1). Only `visibility: everyone`
// activities are ever stored. The refresh token lives in ProviderToken and is
// replaced with whatever Strava returns on every refresh: the old one can stop
// working, and the env copy is only the first seed.

export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

const PROVIDER = "strava";
const TIMEOUT_MS = 15_000;
/** Refresh when the access token has this long or less to live (spec §9.1: 1 hour). */
const REFRESH_MARGIN_S = 3600;
const WINDOW_S = 30 * 86_400;
const PER_PAGE = 100;

/**
 * The real Strava API is called only on Vercel, or locally with
 * `STRAVA_ALLOW_LOCAL=1` (the launch check with Zaid). A refresh from a laptop
 * can rotate the refresh token and leave production's seed dead.
 */
export class StravaLocalGuardError extends Error {
  constructor() {
    super("Strava sync calls the real API only on Vercel. Set STRAVA_ALLOW_LOCAL=1 to run it from this machine.");
    this.name = "StravaLocalGuardError";
  }
}

export function stravaNetworkAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.VERCEL?.trim()) || env.STRAVA_ALLOW_LOCAL === "1";
}

export type StravaDeps = {
  /** Inject a fake in tests. Left out (or the global fetch), the local guard applies. */
  fetch?: typeof globalThis.fetch;
  db?: PrismaClient;
  now?: () => Date;
  /** Defaults to `revalidateFor('strava')` (stale-while-revalidate, cron context). */
  revalidate?: () => void;
};

/** The fetch to use; throws before any request when it's the real one and we're not allowed. */
function stravaFetch(deps: StravaDeps): typeof globalThis.fetch {
  const fetch = deps.fetch ?? globalThis.fetch;
  if (fetch === globalThis.fetch && !stravaNetworkAllowed()) throw new StravaLocalGuardError();
  return fetch;
}

const AUTH_STATUSES = new Set([400, 401, 403]);

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().int().positive(),
});

function envValue(name: "STRAVA_CLIENT_ID" | "STRAVA_CLIENT_SECRET" | "STRAVA_REFRESH_TOKEN"): string | undefined {
  return process.env[name]?.trim() || undefined;
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new SyncShapeError("Strava", `the ${what} body isn't JSON`);
  }
}

/**
 * A valid access token. Reads ProviderToken('strava'); with none, starts from
 * `STRAVA_REFRESH_TOKEN`. With an hour or less left, POSTs a refresh and saves
 * the returned refresh token, access token and expiry before returning.
 * A refused refresh (400/401/403) throws `SyncAuthError`; the stored token is kept.
 * Messages carry status codes only, never a token or Strava's body.
 */
export async function getStravaAccessToken(deps: StravaDeps = {}): Promise<string> {
  const fetch = stravaFetch(deps);
  const { db = prisma, now = () => new Date() } = deps;

  const row = await db.providerToken.findUnique({ where: { provider: PROVIDER } });
  if (row && row.expiresAt.getTime() - now().getTime() > REFRESH_MARGIN_S * 1000) return row.accessToken;

  const refreshToken = row?.refreshToken ?? envValue("STRAVA_REFRESH_TOKEN");
  if (!refreshToken) throw new SyncAuthError("Strava", "no stored token and STRAVA_REFRESH_TOKEN is unset");
  const clientId = envValue("STRAVA_CLIENT_ID");
  const clientSecret = envValue("STRAVA_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Strava sync needs STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.");

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "User-Agent": SYNC_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (AUTH_STATUSES.has(res.status)) throw new SyncAuthError("Strava", `token refresh answered ${res.status}`);
  if (!res.ok) throw new Error(`Strava token refresh responded ${res.status}`);

  const parsed = tokenSchema.safeParse(await readJson(res, "token"));
  if (!parsed.success) throw new SyncShapeError("Strava", "the token response is missing fields");

  const data = {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: new Date(parsed.data.expires_at * 1000),
  };
  await db.providerToken.upsert({ where: { provider: PROVIDER }, create: { provider: PROVIDER, ...data }, update: data });
  return data.accessToken;
}

// Only the fields we read; the rest of Strava's SummaryActivity is ignored.
const activitySchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  name: z.string().nullish(),
  sport_type: z.string().nullish(),
  type: z.string().nullish(),
  distance: z.number().nonnegative().nullish(),
  moving_time: z.number().nonnegative().nullish(),
  start_date: z.iso.datetime({ offset: true }),
  visibility: z.string().nullish(),
  private: z.boolean().nullish(),
});
const activitiesSchema = z.array(activitySchema);

export type StravaActivityInput = {
  id: string;
  name: string;
  sportType: string;
  distanceM: number;
  movingS: number;
  startAt: Date;
  url: string;
};

type RawActivity = z.infer<typeof activitySchema>;

/** Strava's newer `sport_type` ("TrailRun", "WeightTraining"), else the legacy `type`. */
function toActivity(a: RawActivity): StravaActivityInput {
  const id = String(a.id);
  const sportType = a.sport_type?.trim() || a.type?.trim() || "Workout";
  return {
    id,
    name: a.name?.trim() || sportType,
    sportType,
    distanceM: a.distance ?? 0,
    movingS: Math.round(a.moving_time ?? 0),
    startAt: new Date(a.start_date),
    url: `https://www.strava.com/activities/${id}`,
  };
}

const isPublic = (a: RawActivity) => a.visibility === "everyone" && a.private !== true;

const sameActivity = (row: StravaActivityInput, a: StravaActivityInput) =>
  row.name === a.name &&
  row.sportType === a.sportType &&
  row.distanceM === a.distanceM &&
  row.movingS === a.movingS &&
  row.startAt.getTime() === a.startAt.getTime() &&
  row.url === a.url;

/**
 * Fetches the last 30 days, upserts the public ones, deletes stored ones that
 * came back non-public, and revalidates `home` ('max'). When the page is not
 * full (the list is complete), stored activities in the window that didn't
 * come back at all are deleted too: deleted on Strava, or hidden from a token
 * with less scope. A 401 throws `SyncAuthError`; any failure throws before a
 * write, so the stored activities stay as they were.
 */
export async function syncStrava(deps: StravaDeps = {}): Promise<{ itemsChanged: number }> {
  const fetch = stravaFetch(deps);
  const { db = prisma, now = () => new Date(), revalidate = () => revalidateFor("strava") } = deps;
  const after = Math.floor(now().getTime() / 1000) - WINDOW_S;

  const accessToken = await getStravaAccessToken({ ...deps, fetch, db, now });

  const res = await fetch(`${STRAVA_ACTIVITIES_URL}?after=${after}&per_page=${PER_PAGE}`, {
    headers: { "User-Agent": SYNC_USER_AGENT, Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new SyncAuthError("Strava", `activities answered ${res.status}`);
  if (!res.ok) throw new Error(`Strava activities responded ${res.status}`);

  const parsed = activitiesSchema.safeParse(await readJson(res, "activities"));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SyncShapeError("Strava", `activities ${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  const raw = parsed.data;
  const kept = raw.filter(isPublic).map(toActivity);
  const keptIds = kept.map((a) => a.id);
  const hiddenIds = raw.filter((a) => !isPublic(a)).map((a) => String(a.id));
  const complete = raw.length < PER_PAGE;

  const stored = await db.stravaActivity.findMany({ where: { id: { in: keptIds } } });
  const byId = new Map(stored.map((r) => [r.id, r]));
  const changed = kept.filter((a) => {
    const row = byId.get(a.id);
    return !row || !sameActivity(row, a);
  });

  const gone = complete
    ? { OR: [{ id: { in: hiddenIds } }, { startAt: { gt: new Date(after * 1000) }, id: { notIn: keptIds } }] }
    : { id: { in: hiddenIds } };

  const [deleted] = await db.$transaction([
    db.stravaActivity.deleteMany({ where: gone }),
    ...changed.map(({ id, ...data }) => db.stravaActivity.upsert({ where: { id }, create: { id, ...data }, update: data })),
  ]);
  revalidate();
  // Created or edited, plus removed.
  return { itemsChanged: changed.length + (deleted as { count: number }).count };
}

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db as prisma } from "@/lib/db";

// Address → coordinates for food reviews (spec §3 Geocoding). Nominatim is
// called only from an admin server action, with an identifying User-Agent, at
// most once a second, and every hit is cached in GeocodeCache so an address is
// looked up once. Tests inject fetch and the DB; `GEOCODE_FAKE=1` (e2e only,
// refused on Vercel) answers without the network.

export const NOMINATIM_SEARCH_URL =
  "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=";
export const GEOCODE_USER_AGENT = "zaidmadanat.com admin (zaidsmadanat@gmail.com)";
/** Nominatim's usage policy: no more than 1 request per second. */
export const GEOCODE_MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 10_000;

/** The one address `GEOCODE_FAKE=1` knows (Task 24's e2e). Every other address gives null. */
export const GEOCODE_FAKE_ADDRESS = "309 Clement St, San Francisco";
const FAKE_RESULT: GeocodeResult = { lat: 37.783, lng: -122.463, neighbourhood: "Inner Richmond", city: "San Francisco" };

export type GeocodeResult = { lat: number; lng: number; neighbourhood?: string; city?: string };

type CacheRow = { lat: number; lng: number; neighbourhood: string | null; city: string | null };

/** The slice of the Prisma client geocode uses (method syntax, so the real client fits). */
export type GeocodeDb = {
  geocodeCache: {
    findUnique(args: { where: { normalisedAddress: string } }): PromiseLike<CacheRow | null>;
    upsert(args: {
      where: { normalisedAddress: string };
      create: CacheRow & { normalisedAddress: string; raw: Prisma.InputJsonValue };
      update: Record<string, never>;
    }): PromiseLike<unknown>;
  };
};

export type GeocodeDeps = {
  fetch: typeof globalThis.fetch;
  db: GeocodeDb;
  /** Injected by tests; the real ones wait on the clock. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/** The cache key: trimmed, whitespace collapsed, lower-cased. */
export function normaliseAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when `GEOCODE_FAKE=1`. Throws if it's set at all on Vercel: production always geocodes for real. */
export function geocodeFakeEnabled(source: Record<string, string | undefined> = process.env): boolean {
  if (source.GEOCODE_FAKE && (source.VERCEL || source.VERCEL_ENV)) {
    throw new Error("GEOCODE_FAKE is for local e2e only and must not be set on Vercel");
  }
  return source.GEOCODE_FAKE === "1";
}

// Module-level throttle: lookups take turns, and each turn starts at least
// GEOCODE_MIN_INTERVAL_MS after the previous one, however many run at once.
let lastRequestAt = Number.NEGATIVE_INFINITY;
let queue: Promise<void> = Promise.resolve();

function takeTurn(now: () => number, sleep: (ms: number) => Promise<void>): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastRequestAt + GEOCODE_MIN_INTERVAL_MS - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
  });
  queue = turn.catch(() => {});
  return turn;
}

/** Tests only: forget the last request time. */
export function resetGeocodeThrottle(): void {
  lastRequestAt = Number.NEGATIVE_INFINITY;
  queue = Promise.resolve();
}

const nominatimResults = z.array(
  z.object({
    lat: z.coerce.number().refine(Number.isFinite),
    lon: z.coerce.number().refine(Number.isFinite),
    address: z.record(z.string(), z.unknown()).optional(),
  }),
);

const firstString = (address: Record<string, unknown> | undefined, keys: string[]) => {
  for (const key of keys) {
    const v = address?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};

const toResult = (row: CacheRow): GeocodeResult => ({
  lat: row.lat,
  lng: row.lng,
  ...(row.neighbourhood ? { neighbourhood: row.neighbourhood } : {}),
  ...(row.city ? { city: row.city } : {}),
});

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Looks an address up, from GeocodeCache when it's been seen before, else from
 * Nominatim (US only, first result). Null when nothing matches; throws when
 * Nominatim fails or answers with something unexpected (nothing is cached).
 */
export async function geocode(
  address: string,
  deps: GeocodeDeps = { fetch: (...args) => globalThis.fetch(...args), db: prisma },
): Promise<GeocodeResult | null> {
  const key = normaliseAddress(address);
  if (geocodeFakeEnabled()) return key === normaliseAddress(GEOCODE_FAKE_ADDRESS) ? { ...FAKE_RESULT } : null;
  if (!key) return null;

  const hit = await deps.db.geocodeCache.findUnique({ where: { normalisedAddress: key } });
  if (hit) return toResult(hit);

  await takeTurn(deps.now ?? Date.now, deps.sleep ?? realSleep);
  const query = address.trim().replace(/\s+/g, " ");
  const res = await deps.fetch(NOMINATIM_SEARCH_URL + encodeURIComponent(query), {
    headers: { "User-Agent": GEOCODE_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const raw: unknown = await res.json();
  const parsed = nominatimResults.safeParse(raw);
  if (!parsed.success) throw new Error("Geocoding failed: unexpected response from Nominatim");
  const first = parsed.data[0];
  if (!first) return null;

  const row: CacheRow = {
    lat: first.lat,
    lng: first.lon,
    neighbourhood: firstString(first.address, ["neighbourhood", "suburb", "quarter", "city_district"]) ?? null,
    city: firstString(first.address, ["city", "town", "village", "municipality"]) ?? null,
  };
  await deps.db.geocodeCache.upsert({
    where: { normalisedAddress: key },
    create: { normalisedAddress: key, ...row, raw: (raw as Prisma.InputJsonValue[])[0] },
    update: {},
  });
  return toResult(row);
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GEOCODE_FAKE_ADDRESS,
  GEOCODE_USER_AGENT,
  type GeocodeDb,
  geocode,
  geocodeFakeEnabled,
  normaliseAddress,
  resetGeocodeThrottle,
} from "@/lib/geocode";

// Nominatim geocoding with a DB cache and a 1 req/s throttle (spec §3).
// Never calls the real Nominatim: fetch and the DB are injected.

type Row = { normalisedAddress: string; lat: number; lng: number; neighbourhood: string | null; city: string | null; raw: unknown };

function memoryDb() {
  const rows = new Map<string, Row>();
  const db: GeocodeDb = {
    geocodeCache: {
      findUnique: async ({ where }) => rows.get(where.normalisedAddress) ?? null,
      upsert: async ({ where, create }) => {
        const row = rows.get(where.normalisedAddress) ?? (create as Row);
        rows.set(where.normalisedAddress, row);
        return row;
      },
    },
  };
  return { db, rows };
}

const burma = [
  {
    lat: "37.7830",
    lon: "-122.4630",
    display_name: "309, Clement Street, Inner Richmond, San Francisco, California, 94118, United States",
    address: { house_number: "309", road: "Clement Street", neighbourhood: "Inner Richmond", city: "San Francisco", state: "California" },
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;
let clock: number;

beforeEach(() => {
  resetGeocodeThrottle();
  clock = 1_000_000;
  sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const deps = (fetch: typeof globalThis.fetch, db: GeocodeDb) => ({ fetch, db, sleep, now: () => clock });

describe("normaliseAddress", () => {
  it("lower-cases, trims and collapses whitespace", () => {
    expect(normaliseAddress("  309  Clement St,\n San   Francisco ")).toBe("309 clement st, san francisco");
  });
});

describe("geocode", () => {
  it("calls Nominatim with the exact URL and User-Agent, and parses the first result", async () => {
    const { db } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    const result = await geocode("309 Clement St, San Francisco", deps(fetch, db));

    expect(result).toEqual({ lat: 37.783, lng: -122.463, neighbourhood: "Inner Richmond", city: "San Francisco" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=309%20Clement%20St%2C%20San%20Francisco",
    );
    expect(new Headers(init.headers).get("User-Agent")).toBe("zaidmadanat.com admin (zaidsmadanat@gmail.com)");
    expect(GEOCODE_USER_AGENT).toBe("zaidmadanat.com admin (zaidsmadanat@gmail.com)");
  });

  it("caches by normalised address: a second call with different case and spacing doesn't fetch", async () => {
    const { db, rows } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    const first = await geocode("309 Clement St, San Francisco", deps(fetch, db));
    const second = await geocode("  309 CLEMENT st,   san francisco ", deps(fetch, db));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect([...rows.keys()]).toEqual(["309 clement st, san francisco"]);
    expect(rows.get("309 clement st, san francisco")?.raw).toEqual(burma[0]);
  });

  it("returns null for an empty Nominatim result, and doesn't cache it", async () => {
    const { db, rows } = memoryDb();
    const fetch = vi.fn(async () => json([]));
    expect(await geocode("nowhere at all", deps(fetch, db))).toBeNull();
    expect(rows.size).toBe(0);
  });

  it("returns null for a blank address without fetching", async () => {
    const { db } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    expect(await geocode("   ", deps(fetch, db))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to suburb/town for neighbourhood/city and leaves them out when missing", async () => {
    const { db } = memoryDb();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([{ lat: "37.87", lon: "-122.27", address: { suburb: "Downtown", town: "Berkeley" } }]))
      .mockResolvedValueOnce(json([{ lat: "38.1", lon: "-122.2", address: {} }]));
    expect(await geocode("a", deps(fetch, db))).toEqual({ lat: 37.87, lng: -122.27, neighbourhood: "Downtown", city: "Berkeley" });
    expect(await geocode("b", deps(fetch, db))).toEqual({ lat: 38.1, lng: -122.2 });
  });

  it("throws on an HTTP error or an unexpected shape, without caching", async () => {
    const { db, rows } = memoryDb();
    await expect(geocode("a", deps(vi.fn(async () => json({ error: "busy" }, 503)), db))).rejects.toThrow(/HTTP 503/);
    await expect(geocode("b", deps(vi.fn(async () => json({ nope: true })), db))).rejects.toThrow(/unexpected/i);
    expect(rows.size).toBe(0);
  });

  it("keeps to 1 request per second across calls", async () => {
    const { db } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    await geocode("one", deps(fetch, db));
    expect(sleep).not.toHaveBeenCalled();
    clock += 200;
    await geocode("two", deps(fetch, db));
    expect(sleep).toHaveBeenCalledWith(800);
    clock += 5_000;
    await geocode("three", deps(fetch, db));
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("serialises concurrent lookups through the throttle", async () => {
    const { db } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    await Promise.all(["a", "b", "c"].map((a) => geocode(a, deps(fetch, db))));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1000], [1000]]);
    expect(clock).toBe(1_002_000);
  });

  it("a cache hit doesn't wait for the throttle", async () => {
    const { db } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    await geocode("one", deps(fetch, db));
    await geocode("ONE", deps(fetch, db));
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("GEOCODE_FAKE", () => {
  it("returns the fixed Burma Superstar coordinates without fetching or touching the DB", async () => {
    vi.stubEnv("GEOCODE_FAKE", "1");
    const { db, rows } = memoryDb();
    const fetch = vi.fn(async () => json(burma));
    expect(GEOCODE_FAKE_ADDRESS).toBe("309 Clement St, San Francisco");
    expect(await geocode(" 309 clement st,  San Francisco", deps(fetch, db))).toEqual({
      lat: 37.783,
      lng: -122.463,
      neighbourhood: "Inner Richmond",
      city: "San Francisco",
    });
    expect(await geocode("1 Somewhere Else", deps(fetch, db))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it("is off unless set to 1, and refused on Vercel", () => {
    expect(geocodeFakeEnabled({})).toBe(false);
    expect(geocodeFakeEnabled({ GEOCODE_FAKE: "0" })).toBe(false);
    expect(geocodeFakeEnabled({ GEOCODE_FAKE: "1" })).toBe(true);
    expect(() => geocodeFakeEnabled({ GEOCODE_FAKE: "1", VERCEL: "1" })).toThrow(/GEOCODE_FAKE/);
    expect(() => geocodeFakeEnabled({ GEOCODE_FAKE: "1", VERCEL_ENV: "preview" })).toThrow(/GEOCODE_FAKE/);
    expect(geocodeFakeEnabled({ VERCEL: "1" })).toBe(false);
  });
});

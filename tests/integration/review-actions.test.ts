import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// Review server actions and cached geocoding (spec §3, §7 Reviews, §7.3, §8)
// against the test database, with the admin check stubbed and Next's cache
// calls spied on. Nominatim is never called: fetch is injected or stubbed.

const admin = vi.hoisted(() => ({ signedIn: true }));
const cache = vi.hoisted(() => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("@/lib/require-admin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/require-admin")>();
  return {
    ...real,
    requireAdmin: async () => {
      if (!admin.signedIn) throw new real.AdminAuthError();
      return { userId: "u1" };
    },
  };
});
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

const { saveReview, deleteReview, geocodeAction } = await import("@/app/admin/reviews/actions");
const { getPostBySlug } = await import("@/lib/queries/posts");
const { geocode, resetGeocodeThrottle } = await import("@/lib/geocode");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
  cache.updateTag.mockClear();
  cache.revalidateTag.mockClear();
  resetGeocodeThrottle();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const food = (extra: Record<string, unknown> = {}) => ({
  kind: "FOOD" as const,
  title: "Burma Superstar",
  rating: 8,
  date: "2026-10-12",
  address: "309 Clement St, San Francisco",
  lat: 37.783,
  lng: -122.463,
  cuisine: "Burmese",
  price: 2,
  neighbourhood: "Inner Richmond",
  city: "San Francisco",
  region: "SAN_FRANCISCO" as const,
  dishes: [
    { name: "Tea leaf salad", mustOrder: true },
    { name: "Samusa soup", mustOrder: false },
  ],
  ...extra,
});

async function media(...ids: string[]) {
  for (const id of ids) {
    await db.media.create({ data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: `${id}.jpg`, width: 2400, height: 1600, bytes: 1 } });
  }
}

async function post(slug: string, extra: Record<string, unknown> = {}) {
  return db.post.create({
    data: {
      slug,
      title: slug,
      blocks: [],
      html: "<p>Hi</p>",
      category: "FOOD",
      status: "PUBLISHED",
      publishedAt: new Date("2026-10-01T12:00:00Z"),
      ...extra,
    },
  });
}

const tagsExpired = () => cache.updateTag.mock.calls.map((c) => c[0] as string);

async function created(input: Parameters<typeof saveReview>[0]) {
  const r = await saveReview(input);
  if (!r.ok) throw new Error(`save failed: ${r.message}`);
  return r.id;
}

describe("saveReview", () => {
  it("creates a FOOD review with ordered dishes and photos, and expires its tags immediately", async () => {
    await media("m1", "m2");
    const result = await saveReview(food({ photos: ["m2", "m1"] }));
    expect(result.ok).toBe(true);
    const id = (result as { id: string }).id;

    const row = await db.review.findUniqueOrThrow({
      where: { id },
      include: { dishes: { orderBy: { order: "asc" } }, photos: { orderBy: { order: "asc" } } },
    });
    expect(row).toMatchObject({
      kind: "FOOD",
      title: "Burma Superstar",
      rating: 8,
      address: "309 Clement St, San Francisco",
      lat: 37.783,
      lng: -122.463,
      cuisine: "Burmese",
      price: 2,
      neighbourhood: "Inner Richmond",
      city: "San Francisco",
      region: "SAN_FRANCISCO",
      filmLogId: null,
      artist: null,
    });
    expect(row.date.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(row.dishes.map((d) => [d.name, d.mustOrder, d.order])).toEqual([
      ["Tea leaf salad", true, 0],
      ["Samusa soup", false, 1],
    ]);
    expect(row.photos.map((p) => [p.mediaId, p.order])).toEqual([
      ["m2", 0],
      ["m1", 1],
    ]);
    expect(tagsExpired()).toEqual(expect.arrayContaining(["reviews", `review:${id}`, "home"]));
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("updates in place, replacing dishes and photos", async () => {
    await media("m1", "m2");
    const id = await created(food({ photos: ["m1"] }));
    const result = await saveReview(
      food({ title: "Burma Superstar (Clement)", rating: 9, photos: ["m2"], dishes: [{ name: "Rainbow salad", mustOrder: true }] }),
      id,
    );
    expect(result).toEqual({ ok: true, id });
    const row = await db.review.findUniqueOrThrow({ where: { id }, include: { dishes: true, photos: true } });
    expect(row).toMatchObject({ title: "Burma Superstar (Clement)", rating: 9 });
    expect(row.dishes.map((d) => [d.name, d.mustOrder, d.order])).toEqual([["Rainbow salad", true, 0]]);
    expect(row.photos.map((p) => p.mediaId)).toEqual(["m2"]);
    expect(await db.review.count()).toBe(1);
  });

  it("returns field errors for invalid input and writes nothing", async () => {
    const result = await saveReview(food({ rating: 0, region: undefined, city: "Pacifica" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["rating", "region"]);
    expect(result.fieldErrors?.region).toMatch(/pick a region/i);
    expect(await db.review.count()).toBe(0);
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("returns a friendly error for an unknown review id or a missing photo", async () => {
    expect(await saveReview(food(), "nope")).toEqual({ ok: false, message: expect.stringMatching(/no longer exists/i) });
    expect(await saveReview(food({ photos: ["ghost"] }))).toEqual({ ok: false, message: expect.stringMatching(/photo/i) });
    expect(await db.review.count()).toBe(0);
  });

  it("saves a manual FILM review (no log) and one linked to a log; a log takes one review only", async () => {
    const manual = await created({ kind: "FILM", title: "Paris, Texas", year: 1984, rating: 9, date: "2026-10-20" });
    expect(await db.review.findUniqueOrThrow({ where: { id: manual } })).toMatchObject({ kind: "FILM", filmLogId: null, year: 1984 });

    const log = await db.filmLog.create({
      data: {
        letterboxdGuid: "letterboxd-watch-1",
        entryType: "WATCH",
        title: "Ben-Hur",
        year: 1959,
        watchedAt: new Date("2026-04-26"),
        url: "https://letterboxd.com/x/film/ben-hur/",
      },
    });
    const linked = await created({ kind: "FILM", title: "Ben-Hur", rating: 10, date: "2026-04-26", filmLogId: log.id });
    expect((await db.review.findUniqueOrThrow({ where: { id: linked } })).filmLogId).toBe(log.id);
    // Saving the same review again keeps its own log.
    expect(await saveReview({ kind: "FILM", title: "Ben-Hur", rating: 9, date: "2026-04-26", filmLogId: log.id }, linked)).toEqual({ ok: true, id: linked });

    const again = await saveReview({ kind: "FILM", title: "Ben-Hur", rating: 8, date: "2026-04-27", filmLogId: log.id });
    expect(again).toEqual({ ok: false, message: expect.stringMatching(/already has a review/i) });
    expect(await saveReview({ kind: "FILM", title: "X", rating: 8, date: "2026-04-27", filmLogId: "missing" })).toEqual({
      ok: false,
      message: expect.stringMatching(/film/i),
    });
  });

  it("saves ALBUM and CONCERT reviews; a concert without a title is named after the artist", async () => {
    const album = await created({ kind: "ALBUM", title: "In Rainbows", artist: "Radiohead", year: 2007, rating: 9, date: "2026-10-01" });
    expect(await db.review.findUniqueOrThrow({ where: { id: album } })).toMatchObject({ artist: "Radiohead", year: 2007, coverUrl: null });
    const concert = await created({ kind: "CONCERT", artist: "Radiohead", venue: "Greek Theatre", rating: 9, date: "2026-09-20" });
    expect(await db.review.findUniqueOrThrow({ where: { id: concert } })).toMatchObject({
      title: "Radiohead",
      artist: "Radiohead",
      venue: "Greek Theatre",
      highlight: null,
    });
  });

  it("links a post, moves the link to another post, and unlinks; each affected post is expired", async () => {
    const a = await post("burma-superstar");
    const b = await post("burma-superstar-again");
    const id = await created(food({ postId: a.id }));
    expect((await db.post.findUniqueOrThrow({ where: { id: a.id } })).reviewId).toBe(id);
    expect(tagsExpired()).toEqual(expect.arrayContaining([`review:${id}`, `post:${a.id}`, "posts"]));

    cache.updateTag.mockClear();
    expect(await saveReview(food({ postId: b.id }), id)).toEqual({ ok: true, id });
    expect((await db.post.findUniqueOrThrow({ where: { id: a.id } })).reviewId).toBeNull();
    expect((await db.post.findUniqueOrThrow({ where: { id: b.id } })).reviewId).toBe(id);
    expect(tagsExpired()).toEqual(expect.arrayContaining([`post:${a.id}`, `post:${b.id}`]));

    // Leaving postId out keeps the link; null removes it.
    await saveReview(food({ rating: 7 }), id);
    expect((await db.post.findUniqueOrThrow({ where: { id: b.id } })).reviewId).toBe(id);
    cache.updateTag.mockClear();
    await saveReview(food({ postId: null }), id);
    expect((await db.post.findUniqueOrThrow({ where: { id: b.id } })).reviewId).toBeNull();
    expect(tagsExpired()).toContain(`post:${b.id}`);
  });

  it("won't link a post that already has another review, and changes nothing", async () => {
    const p = await post("burma-superstar");
    const first = await created(food({ postId: p.id }));
    const second = await created(food({ title: "Another place" }));
    cache.updateTag.mockClear();

    const result = await saveReview(food({ title: "Another place", rating: 3, postId: p.id }), second);
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/already linked to another review/i) });
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).reviewId).toBe(first);
    expect((await db.review.findUniqueOrThrow({ where: { id: second } })).rating).toBe(8);
    expect(cache.updateTag).not.toHaveBeenCalled();

    const fresh = await saveReview(food({ title: "Third", postId: p.id }));
    expect(fresh.ok).toBe(false);
    expect(await db.review.count()).toBe(2);

    expect(await saveReview(food({ postId: "missing-post" }))).toEqual({ ok: false, message: expect.stringMatching(/post/i) });
  });
});

describe("deleteReview (Review Focus 5)", () => {
  it("clears the linked post's reviewId, expires that post, and the post page still loads without a rating box", async () => {
    await media("m1");
    const p = await post("burma-superstar");
    const id = await created(food({ postId: p.id, photos: ["m1"] }));
    const before = await getPostBySlug("burma-superstar");
    expect(before && "post" in before && before.post.review?.title).toBe("Burma Superstar");
    cache.updateTag.mockClear();

    await deleteReview(id);

    expect(await db.review.findUnique({ where: { id } })).toBeNull();
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).reviewId).toBeNull();
    expect(await db.dish.count()).toBe(0);
    expect(await db.reviewMedia.count()).toBe(0);
    expect(await db.media.count()).toBe(1);
    expect(tagsExpired()).toEqual(expect.arrayContaining(["reviews", `review:${id}`, "home", `post:${p.id}`, "posts"]));

    const after = await getPostBySlug("burma-superstar");
    expect(after && "post" in after).toBe(true);
    if (after && "post" in after) {
      expect(after.post.review).toBeNull();
      expect(after.post.title).toBe("burma-superstar");
    }
  });

  it("deletes an unlinked review, and an unknown id is a no-op", async () => {
    const id = await created(food());
    await deleteReview(id);
    expect(await db.review.count()).toBe(0);
    await expect(deleteReview(id)).resolves.toBeUndefined();
  });
});

describe("admin only", () => {
  it("every action refuses without an admin session and writes nothing", async () => {
    const id = await created(food());
    admin.signedIn = false;
    await expect(saveReview(food())).rejects.toThrow(/admin session required/i);
    await expect(deleteReview(id)).rejects.toThrow(/admin session required/i);
    await expect(geocodeAction("309 Clement St, San Francisco")).rejects.toThrow(/admin session required/i);
    expect(await db.review.count()).toBe(1);
  });
});

describe("geocoding", () => {
  it("caches lookups in GeocodeCache by normalised address", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ lat: "37.783", lon: "-122.463", address: { neighbourhood: "Inner Richmond", city: "San Francisco" } }]),
        ),
    );
    const deps = { fetch, db, sleep: async () => {} };
    const first = await geocode("309 Clement St, San Francisco", deps);
    const second = await geocode("309  clement st, SAN FRANCISCO", deps);
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    const rows = await db.geocodeCache.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ normalisedAddress: "309 clement st, san francisco", lat: 37.783, lng: -122.463, city: "San Francisco" });
  });

  it("geocodeAction under GEOCODE_FAKE=1 returns the fixed coordinates and never fetches", async () => {
    vi.stubEnv("GEOCODE_FAKE", "1");
    const fetch = vi.fn(async () => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetch);
    expect(await geocodeAction("309 Clement St, San Francisco")).toEqual({
      lat: 37.783,
      lng: -122.463,
      neighbourhood: "Inner Richmond",
      city: "San Francisco",
    });
    expect(await geocodeAction("1 Unknown Rd")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("geocodeAction rejects a blank or oversized address without fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(geocodeAction("  ")).rejects.toThrow();
    await expect(geocodeAction("x".repeat(400))).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// setFavorites and the favourites admin's reads (spec §7 Favourites, §8
// Favorite, §7.3), against the test database with the admin check stubbed and
// Next's cache calls spied on.

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

const { setFavorites } = await import("@/app/admin/favourites/actions");
const { getFavouritesAdmin } = await import("@/lib/admin/favourites");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
  cache.updateTag.mockClear();
  cache.revalidateTag.mockClear();
});

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

async function log(id: string, title: string, year = 2000, extra: Record<string, unknown> = {}) {
  return db.filmLog.create({
    data: {
      id,
      letterboxdGuid: `letterboxd-watch-${id}`,
      entryType: "WATCH",
      title,
      year,
      watchedAt: day("2026-04-01"),
      url: `https://letterboxd.com/x/film/${id}/`,
      ...extra,
    },
  });
}

const rows = (kind: "FILM" | "ALBUM") =>
  db.favorite.findMany({ where: { kind }, orderBy: { position: "asc" }, select: { position: true, title: true, artist: true, year: true, coverUrl: true, filmLogId: true, reviewId: true } });

async function fourLogs() {
  for (const [i, t] of ["Ben-Hur", "A Clockwork Orange", "Whisper of the Heart", "The Aviator", "Yojimbo"].entries()) {
    await log(`log${i + 1}`, t, 1950 + i, { posterUrl: i === 0 ? "https://a.ltrbxd.com/ben-hur.jpg" : null });
  }
}

describe("setFavorites", () => {
  it("setting 4 then 3 film favourites leaves exactly 3 rows, in the order given", async () => {
    await fourLogs();
    await setFavorites("FILM", ["log1", "log2", "log3", "log4"].map((filmLogId) => ({ ref: { filmLogId }, title: "x" })));
    expect((await rows("FILM")).map((r) => r.title)).toEqual(["Ben-Hur", "A Clockwork Orange", "Whisper of the Heart", "The Aviator"]);

    await setFavorites("FILM", ["log4", "log1", "log5"].map((filmLogId) => ({ ref: { filmLogId }, title: "x" })));
    const after = await rows("FILM");
    expect(after.map((r) => [r.position, r.title, r.filmLogId])).toEqual([
      [1, "The Aviator", "log4"],
      [2, "Ben-Hur", "log1"],
      [3, "Yojimbo", "log5"],
    ]);
    expect(after[1]).toMatchObject({ year: 1950, coverUrl: "https://a.ltrbxd.com/ben-hur.jpg" });
  });

  it("5 items throws and changes nothing", async () => {
    await fourLogs();
    await setFavorites("FILM", [{ ref: { filmLogId: "log1" }, title: "x" }]);
    cache.updateTag.mockClear();
    const five = ["log1", "log2", "log3", "log4", "log5"].map((filmLogId) => ({ ref: { filmLogId }, title: "x" }));
    await expect(setFavorites("FILM", five)).rejects.toThrow();
    expect((await rows("FILM")).map((r) => r.title)).toEqual(["Ben-Hur"]);
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("the snapshot title survives deletion of the referenced FilmLog", async () => {
    await log("gone", "Paris, Texas", 1984);
    await setFavorites("FILM", [{ ref: { filmLogId: "gone" }, title: "Paris, Texas" }]);
    await db.filmLog.delete({ where: { id: "gone" } });
    expect(await rows("FILM")).toEqual([
      { position: 1, title: "Paris, Texas", artist: null, year: 1984, coverUrl: null, filmLogId: null, reviewId: null },
    ]);
    const { films } = await getFavouritesAdmin();
    expect(films).toEqual([{ title: "Paris, Texas", year: 1984 }]);
  });

  it("snapshots from the referenced row, not from what the browser sent", async () => {
    await log("l1", "The Aviator", 2004, { posterUrl: "https://a.ltrbxd.com/aviator.jpg" });
    await db.review.create({ data: { id: "rf", kind: "FILM", title: "The Aviator", rating: 9, date: day("2026-04-24"), filmLogId: "l1" } });
    await setFavorites("FILM", [{ ref: { reviewId: "rf" }, title: "Something else", year: 1 }]);
    expect(await rows("FILM")).toEqual([
      { position: 1, title: "The Aviator", artist: null, year: 2004, coverUrl: "https://a.ltrbxd.com/aviator.jpg", filmLogId: null, reviewId: "rf" },
    ]);
  });

  it("albums: from an ALBUM review or typed in; trims, and drops blank optional fields", async () => {
    await db.review.create({
      data: { id: "ra", kind: "ALBUM", title: "GNX", artist: "Kendrick Lamar", year: 2024, coverUrl: "https://x.test/gnx.jpg", rating: 8, date: day("2026-09-01") },
    });
    await setFavorites("ALBUM", [
      { title: "  Blonde ", artist: "Frank Ocean", year: 2016, coverUrl: "" },
      { ref: { reviewId: "ra" }, title: "GNX" },
    ]);
    expect(await rows("ALBUM")).toEqual([
      { position: 1, title: "Blonde", artist: "Frank Ocean", year: 2016, coverUrl: null, filmLogId: null, reviewId: null },
      { position: 2, title: "GNX", artist: "Kendrick Lamar", year: 2024, coverUrl: "https://x.test/gnx.jpg", filmLogId: null, reviewId: "ra" },
    ]);
    // The other kind is untouched.
    expect(await rows("FILM")).toEqual([]);
  });

  it("refuses refs of the wrong kind, unknown refs, duplicates and blank titles", async () => {
    await log("l1", "Ben-Hur", 1959);
    await db.review.create({ data: { id: "ra", kind: "ALBUM", title: "GNX", artist: "K", rating: 8, date: day("2026-09-01") } });
    await db.review.create({ data: { id: "rc", kind: "CONCERT", title: "Khruangbin", artist: "Khruangbin", venue: "Greek", rating: 9, date: day("2026-09-01") } });
    await expect(setFavorites("FILM", [{ ref: { reviewId: "ra" }, title: "GNX" }])).rejects.toThrow();
    await expect(setFavorites("ALBUM", [{ ref: { reviewId: "rc" }, title: "K" }])).rejects.toThrow();
    await expect(setFavorites("ALBUM", [{ ref: { filmLogId: "l1" }, title: "Ben-Hur" }])).rejects.toThrow();
    await expect(setFavorites("FILM", [{ ref: { filmLogId: "nope" }, title: "?" }])).rejects.toThrow();
    await expect(setFavorites("FILM", [{ ref: { filmLogId: "l1" }, title: "a" }, { ref: { filmLogId: "l1" }, title: "a" }])).rejects.toThrow();
    await expect(setFavorites("FILM", [{ title: "  " }])).rejects.toThrow();
    expect(await db.favorite.count()).toBe(0);
  });

  it("expires the reviews tag right away, and an empty list clears the kind", async () => {
    await setFavorites("ALBUM", [{ title: "Blonde", artist: "Frank Ocean" }]);
    expect(cache.updateTag).toHaveBeenCalledWith("reviews");
    expect(cache.revalidateTag).not.toHaveBeenCalled();
    await setFavorites("ALBUM", []);
    expect(await db.favorite.count()).toBe(0);
  });

  it("needs the admin", async () => {
    admin.signedIn = false;
    await expect(setFavorites("FILM", [{ title: "Ben-Hur" }])).rejects.toThrow();
    expect(await db.favorite.count()).toBe(0);
  });
});

describe("getFavouritesAdmin", () => {
  it("returns the current lists and the picker's choices", async () => {
    await log("l1", "Ben-Hur", 1959, { watchedAt: day("2026-04-26"), posterUrl: "https://a.ltrbxd.com/b.jpg" });
    await log("l2", "Yojimbo", 1961, { watchedAt: day("2026-04-25") });
    await log("l3", "Ben-Hur", 1959, { watchedAt: day("2026-03-01") }); // a rewatch: offered once
    await db.review.create({ data: { id: "rf", kind: "FILM", title: "Ben-Hur", rating: 10, date: day("2026-04-26"), filmLogId: "l1" } });
    await db.review.create({ data: { id: "ra", kind: "ALBUM", title: "GNX", artist: "Kendrick Lamar", year: 2024, rating: 8, date: day("2026-09-01") } });
    await db.albumListen.create({
      data: { id: "al", statsfmAlbumId: "s1", title: "Blonde", artist: "Frank Ocean", year: 2016, coverUrl: "", rank: 1, streams: 9, windowStart: day("2026-10-20"), windowEnd: day("2026-10-27") },
    });
    await setFavorites("FILM", [{ ref: { filmLogId: "l2" }, title: "Yojimbo" }]);

    const data = await getFavouritesAdmin();
    expect(data.films).toEqual([{ ref: { filmLogId: "l2" }, title: "Yojimbo", year: 1961 }]);
    expect(data.albums).toEqual([]);
    expect(data.filmChoices.map((c) => [c.group, c.label, c.item.ref])).toEqual([
      ["Film reviews", "Ben-Hur (1959) · 10/10", { reviewId: "rf" }],
      ["From the diary", "Ben-Hur (1959) · Apr 26", { filmLogId: "l1" }],
      ["From the diary", "Yojimbo (1961) · Apr 25", { filmLogId: "l2" }],
    ]);
    expect(data.filmChoices[0].item).toMatchObject({ title: "Ben-Hur", year: 1959, coverUrl: "https://a.ltrbxd.com/b.jpg" });
    expect(data.albumChoices.map((c) => [c.group, c.label, c.item])).toEqual([
      ["Album reviews", "GNX · Kendrick Lamar · 8/10", { ref: { reviewId: "ra" }, title: "GNX", artist: "Kendrick Lamar", year: 2024 }],
      ["This week's listening", "Blonde · Frank Ocean", { title: "Blonde", artist: "Frank Ocean", year: 2016 }],
    ]);
  });
});

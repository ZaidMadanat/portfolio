import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

const { syncLetterboxd, LETTERBOXD_USER_AGENT } = await import("@/lib/sync/letterboxd");

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

/** A fetch that serves `body` (or a status) and records each call. */
function feedFetch(body: () => string, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(body(), { status }));
}

beforeEach(async () => {
  await resetDb();
  cache.revalidateTag.mockClear();
  cache.updateTag.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const expectRevalidated = (times: number) => {
  expect(cache.revalidateTag).toHaveBeenCalledTimes(3 * times);
  for (const tag of ["films", "home", "reviews"]) expect(cache.revalidateTag).toHaveBeenCalledWith(tag, "max");
  expect(cache.updateTag).not.toHaveBeenCalled();
};

describe("syncLetterboxd", () => {
  it("upserts the real feed by guid; a second identical run changes nothing but still revalidates", async () => {
    const fetch = feedFetch(() => fixture("letterboxd.xml"));

    await expect(syncLetterboxd({ fetch, db })).resolves.toEqual({ itemsChanged: 50 });
    expect(await db.filmLog.count()).toBe(50);
    expectRevalidated(1);

    await expect(syncLetterboxd({ fetch, db })).resolves.toEqual({ itemsChanged: 0 });
    expect(await db.filmLog.count()).toBe(50);
    // Month stats are baked in at render, so even a no-change run expires the film tags.
    expectRevalidated(2);

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://letterboxd.com/itsMaday/rss/");
    expect(new Headers(init?.headers).get("user-agent")).toBe(LETTERBOXD_USER_AGENT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("stores the edge cases as one correct row each (Review Focus 1)", async () => {
    await expect(syncLetterboxd({ fetch: feedFetch(() => fixture("letterboxd-edge.xml")), db })).resolves.toEqual({
      itemsChanged: 5,
    });
    const rows = await db.filmLog.findMany({ orderBy: { letterboxdGuid: "asc" } });
    expect(
      rows.map((r) => [
        r.letterboxdGuid,
        r.entryType,
        r.title,
        r.stars == null ? null : Number(r.stars),
        r.rating,
        r.watchedAt.toISOString().slice(0, 10),
        r.rewatch,
        r.hasLetterboxdReview,
      ]),
    ).toEqual([
      ["letterboxd-review-9000000004", "REVIEW", "Love & Death", 4, 8, "2026-10-23", false, true],
      ["letterboxd-watch-9000000001", "WATCH", "Yojimbo", null, null, "2026-10-26", false, false],
      ["letterboxd-watch-9000000002", "WATCH", "Cries and Whispers", 3.5, 7, "2026-10-25", false, false],
      ["letterboxd-watch-9000000003", "WATCH", "Akira", 4.5, 9, "2026-10-24", true, false],
      ["letterboxd-watch-9000000005", "WATCH", "Cries and Whispers", 4, 8, "2026-09-12", true, false],
    ]);
  });

  it("counts only the items that changed, updates them in place, and keeps a linked review", async () => {
    let xml = fixture("letterboxd-edge.xml");
    const fetch = feedFetch(() => xml);
    await syncLetterboxd({ fetch, db });
    const akira = await db.filmLog.findUniqueOrThrow({ where: { letterboxdGuid: "letterboxd-watch-9000000003" } });
    await db.review.create({ data: { kind: "FILM", title: "Akira", rating: 9, date: akira.watchedAt, filmLogId: akira.id } });

    // Zaid re-rates Akira and un-likes it on Letterboxd.
    xml = xml.replace(
      "<letterboxd:memberRating>4.5</letterboxd:memberRating>\n\t\t\t<letterboxd:memberLike>Yes</letterboxd:memberLike>\n\t\t\t<tmdb:movieId>149</tmdb:movieId>",
      "<letterboxd:memberRating>5.0</letterboxd:memberRating>\n\t\t\t<letterboxd:memberLike>No</letterboxd:memberLike>\n\t\t\t<tmdb:movieId>149</tmdb:movieId>",
    );
    await expect(syncLetterboxd({ fetch, db })).resolves.toEqual({ itemsChanged: 1 });

    const after = await db.filmLog.findUniqueOrThrow({
      where: { letterboxdGuid: "letterboxd-watch-9000000003" },
      include: { review: true },
    });
    expect([after.id, Number(after.stars), after.rating, after.liked]).toEqual([akira.id, 5, 10, false]);
    expect(after.review?.rating).toBe(9);
    expect(await db.filmLog.count()).toBe(5);
  });

  it("an HTTP error throws, leaves the rows alone, and still revalidates", async () => {
    await syncLetterboxd({ fetch: feedFetch(() => fixture("letterboxd-edge.xml")), db });
    cache.revalidateTag.mockClear();

    await expect(syncLetterboxd({ fetch: feedFetch(() => "nope", 503), db })).rejects.toThrow(/503/);
    expect(await db.filmLog.count()).toBe(5);
    expectRevalidated(1);
  });

  it("a body that isn't RSS throws without writing", async () => {
    await expect(syncLetterboxd({ fetch: feedFetch(() => "<html>rate limited</html>"), db })).rejects.toThrow(/RSS/);
    expect(await db.filmLog.count()).toBe(0);
  });
});

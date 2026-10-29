import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFilmLogs } from "@/lib/queries/films";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged read directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

beforeEach(resetDb);

let n = 0;
const log = (title: string, watchedAt: string, stars: number | null, extra: Record<string, unknown> = {}) => {
  n += 1;
  return db.filmLog.create({
    data: {
      letterboxdGuid: `letterboxd-watch-${n}`,
      entryType: "WATCH",
      title,
      year: 2000 + n,
      stars,
      rating: stars == null ? null : Math.round(stars * 2),
      watchedAt: new Date(`${watchedAt}T00:00:00.000Z`),
      url: `https://letterboxd.com/itsMaday/film/${n}/`,
      ...extra,
    },
  });
};

const post = (slug: string, reviewId: string, status: "DRAFT" | "PUBLISHED") =>
  db.post.create({
    data: { slug, title: slug, excerpt: "", blocks: [], html: "", category: "FILM", status, readingMinutes: 1, reviewId },
  });

describe("getFilmLogs", () => {
  it("a linked FILM review's rating overrides stars ×2, and the card links to its published post", async () => {
    const l = await log("The Aviator", "2026-04-25", 4.5, { posterUrl: "https://a.ltrbxd.com/aviator.jpg" });
    const review = await db.review.create({
      data: { kind: "FILM", title: "The Aviator", rating: 7, date: new Date("2026-04-25"), filmLogId: l.id },
    });
    await post("the-aviator", review.id, "PUBLISHED");

    const [card] = await getFilmLogs();
    expect(card).toEqual({
      id: l.id,
      title: "The Aviator",
      year: l.year,
      stars: 4.5,
      rating: 7,
      watchedAt: "2026-04-25",
      posterUrl: "https://a.ltrbxd.com/aviator.jpg",
      href: "/blog/the-aviator",
      hasReview: true,
    });
  });

  it("keeps the log's rating without a review, null when unrated, and links only a published post", async () => {
    await log("Yojimbo", "2026-04-26", null);
    await log("Lolita", "2026-04-23", 4.5);
    const drafted = await log("Spartacus", "2026-04-22", 3.5);
    const review = await db.review.create({
      data: { kind: "FILM", title: "Spartacus", rating: 8, date: new Date("2026-04-22"), filmLogId: drafted.id },
    });
    await post("spartacus", review.id, "DRAFT");

    const cards = await getFilmLogs();
    expect(cards.map((c) => [c.title, c.stars, c.rating, c.hasReview, c.href, c.posterUrl])).toEqual([
      ["Yojimbo", null, null, false, null, null],
      ["Lolita", 4.5, 9, false, null, null],
      ["Spartacus", 3.5, 8, true, null, null],
    ]);
  });

  it("orders newest first, the same day by id, and stops at the limit", async () => {
    const a = await log("Same day 1", "2026-04-22", 3);
    const b = await log("Same day 2", "2026-04-22", 3);
    await log("Older", "2026-03-01", 3);
    await log("Newest", "2026-04-30", 3);
    const sameDay = [a.id, b.id].sort().reverse();

    const cards = await getFilmLogs();
    expect(cards.map((c) => c.id)).toEqual([cards[0].id, ...sameDay, cards[3].id]);
    expect(cards.map((c) => c.title)[0]).toBe("Newest");
    expect(cards[3].title).toBe("Older");
    expect((await getFilmLogs(2)).map((c) => c.title)).toEqual(["Newest", cards[1].title]);
  });

  it("is empty with no logs", async () => {
    await expect(getFilmLogs()).resolves.toEqual([]);
  });
});

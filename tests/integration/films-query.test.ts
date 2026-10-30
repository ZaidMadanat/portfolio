import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { filterFilms } from "@/lib/film-stats";
import { getFilmLogs, monthStats } from "@/lib/queries/films";
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

// Hand-entered FILM reviews (no FilmLog) sit in the same grid, by Review.date.
describe("getFilmLogs with manual film reviews", () => {
  const manual = (title: string, date: string, rating: number, year: number | null = null) =>
    db.review.create({ data: { kind: "FILM", title, rating, date: new Date(`${date}T00:00:00.000Z`), year } });

  it("merges a manual review between the logs by date, with its rating, REVIEW tag and post link", async () => {
    await log("Newer log", "2026-04-25", 4);
    await log("Older log", "2026-04-20", 3);
    const r = await manual("Seen at the Castro", "2026-04-22", 8, 1999);
    await post("seen-at-the-castro", r.id, "PUBLISHED");

    const cards = await getFilmLogs();
    expect(cards.map((c) => c.title)).toEqual(["Newer log", "Seen at the Castro", "Older log"]);
    expect(cards[1]).toEqual({
      id: `review:${r.id}`,
      title: "Seen at the Castro",
      year: 1999,
      stars: null,
      rating: 8,
      watchedAt: "2026-04-22",
      posterUrl: null,
      href: "/blog/seen-at-the-castro",
      hasReview: true,
    });
  });

  it("never repeats a linked review, ignores other kinds, and links only a published post", async () => {
    const l = await log("Logged", "2026-04-24", 4.5);
    await db.review.create({ data: { kind: "FILM", title: "Logged", rating: 7, date: new Date("2026-04-24"), filmLogId: l.id } });
    await db.review.create({ data: { kind: "ALBUM", title: "Kid A", rating: 10, date: new Date("2026-04-23"), artist: "Radiohead" } });
    const drafted = await manual("No year, draft post", "2026-04-23", 6);
    await post("no-year-draft", drafted.id, "DRAFT");

    const cards = await getFilmLogs();
    expect(cards.map((c) => [c.id, c.title, c.year, c.rating, c.hasReview, c.href])).toEqual([
      [l.id, "Logged", l.year, 7, true, null],
      [`review:${drafted.id}`, "No year, draft post", null, 6, true, null],
    ]);
  });

  it("orders a same-day log and review by their unique id, and the limit covers both", async () => {
    const a = await log("Same day log", "2026-04-22", 3);
    const r = await manual("Same day review", "2026-04-22", 9);
    await manual("Oldest review", "2026-03-01", 5);
    await log("Newest log", "2026-04-30", 3);
    const sameDay = [a.id, `review:${r.id}`].sort().reverse();

    const cards = await getFilmLogs();
    expect(cards.map((c) => c.id)).toEqual([cards[0].id, ...sameDay, cards[3].id]);
    expect([cards[0].title, cards[3].title]).toEqual(["Newest log", "Oldest review"]);
    expect((await getFilmLogs(3)).map((c) => c.id)).toEqual(cards.slice(0, 3).map((c) => c.id));
    expect(await getFilmLogs()).toEqual(cards);
  });

  it("month stats and the chips count manual reviews", async () => {
    await log("April log", "2026-04-25", 4);
    await log("April unrated", "2026-04-24", null);
    await manual("April review", "2026-04-23", 9);
    await manual("March review", "2026-03-31", 10);

    const cards = await getFilmLogs();
    expect(monthStats(cards, new Date("2026-04-28T19:00:00.000Z"))).toEqual({ count: 3, average: 8.5 });
    expect(filterFilms(cards, "top").map((c) => c.title)).toEqual(["April review", "March review"]);
    expect(filterFilms(cards, "review").map((c) => c.title)).toEqual(["April review", "March review"]);
  });
});

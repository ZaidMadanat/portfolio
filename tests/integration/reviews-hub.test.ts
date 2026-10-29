import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFilmMonthStats } from "@/lib/queries/films";
import { getReviewsHub } from "@/lib/queries/reviews";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged read directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

beforeEach(resetDb);

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = new Date("2026-04-28T19:00:00.000Z");

let n = 0;
const log = (title: string, watchedAt: string) => {
  n += 1;
  return db.filmLog.create({
    data: {
      letterboxdGuid: `letterboxd-watch-hub-${n}`,
      entryType: "WATCH",
      title,
      year: 2000 + n,
      stars: 4,
      rating: 8,
      watchedAt: day(watchedAt),
      url: `https://letterboxd.com/itsMaday/film/hub-${n}/`,
    },
  });
};

describe("the /reviews hub film tile", () => {
  it("counts hand-entered FILM reviews this month, the same number /reviews/film shows", async () => {
    const logged = await log("April log", "2026-04-25");
    await log("Second April log", "2026-04-02");
    await log("March log", "2026-03-31");
    // A review linked to a log is that log's card, not a second film.
    await db.review.create({ data: { kind: "FILM", title: "April log", rating: 9, date: day("2026-04-25"), filmLogId: logged.id } });
    await db.review.create({ data: { kind: "FILM", title: "Seen at the Castro", rating: 8, date: day("2026-04-22") } });
    await db.review.create({ data: { kind: "FILM", title: "March review", rating: 7, date: day("2026-03-30") } });
    await db.review.create({ data: { kind: "ALBUM", title: "Kid A", rating: 10, date: day("2026-04-20"), artist: "Radiohead" } });

    const hub = await getReviewsHub(NOW);
    const film = await getFilmMonthStats(NOW);
    expect(film.count).toBe(3);
    expect(hub.counts.filmThisMonth).toBe(film.count);
  });

  it("is 0 with no films this month", async () => {
    await log("March log", "2026-03-31");
    expect((await getReviewsHub(NOW)).counts.filmThisMonth).toBe(0);
  });
});

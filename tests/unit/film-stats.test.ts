import { describe, expect, it } from "vitest";
import { FILM_FILTERS, filterFilms, monthStats, starsLabel } from "@/lib/film-stats";
import type { FilmCard } from "@/lib/queries/films";

// Zaid's real April 2026 diary (the canvas Film board): 12 logs, Yojimbo unrated.
const APRIL: [string, number | null, string][] = [
  ["Ben-Hur", 5, "2026-04-26"],
  ["Yojimbo", null, "2026-04-26"],
  ["The Aviator", 4.5, "2026-04-25"],
  ["A Clockwork Orange", 5, "2026-04-24"],
  ["Mother Mary", 3, "2026-04-24"],
  ["Lolita", 4.5, "2026-04-23"],
  ["Spartacus", 3.5, "2026-04-22"],
  ["Whisper of the Heart", 4.5, "2026-04-22"],
  ["Licorice Pizza", 3, "2026-04-22"],
  ["Hard Eight", 3, "2026-04-17"],
  ["Cave of Forgotten Dreams", 4, "2026-04-16"],
  ["Exit 8", 3.5, "2026-04-15"],
];

const card = (title: string, stars: number | null, watchedAt: string, extra: Partial<FilmCard> = {}): FilmCard => ({
  id: title,
  title,
  year: 2000,
  stars,
  rating: stars == null ? null : stars * 2,
  watchedAt,
  posterUrl: null,
  href: null,
  hasReview: false,
  ...extra,
});

const april = APRIL.map(([t, s, d]) => card(t, s, d));

describe("monthStats", () => {
  it("the 12 April logs (11 rated) give count 12 and average 7.9", () => {
    expect(monthStats(april, new Date("2026-04-28T19:00:00.000Z"))).toEqual({ count: 12, average: 7.9 });
  });

  it("counts only the calendar month of now in Los Angeles", () => {
    const cards = [card("May Day", 2, "2026-05-01"), ...april, card("March", 5, "2026-03-31")];
    // 05:00 UTC on May 1 is still April 30 in Los Angeles.
    expect(monthStats(cards, new Date("2026-05-01T05:00:00.000Z"))).toEqual({ count: 12, average: 7.9 });
    expect(monthStats(cards, new Date("2026-05-01T08:00:00.000Z"))).toEqual({ count: 1, average: 4 });
  });

  it("uses the displayed rating, and has no average without a rated log", () => {
    const reviewed = card("Ben-Hur", 4.5, "2026-04-26", { rating: 7, hasReview: true });
    expect(monthStats([reviewed, card("Yojimbo", null, "2026-04-26")], new Date("2026-04-27T12:00:00Z"))).toEqual({
      count: 2,
      average: 7,
    });
    expect(monthStats([card("Yojimbo", null, "2026-04-26")], new Date("2026-04-27T12:00:00Z"))).toEqual({
      count: 1,
      average: null,
    });
    expect(monthStats([], new Date("2026-04-27T12:00:00Z"))).toEqual({ count: 0, average: null });
  });
});

describe("filterFilms", () => {
  it("has the three chips in order", () => {
    expect(FILM_FILTERS.map((f) => f.label)).toEqual(["All logs", "9 and up", "Has a review"]);
  });

  it('"9 and up" uses the displayed rating; "Has a review" the linked review', () => {
    const cards = [
      card("Rated 9 by stars, 7 by review", 4.5, "2026-04-25", { rating: 7, hasReview: true }),
      card("Rated 10", 5, "2026-04-24"),
      card("Unrated", null, "2026-04-23"),
      card("Rated 8", 4, "2026-04-22"),
    ];
    expect(filterFilms(cards, "all")).toHaveLength(4);
    expect(filterFilms(cards, "top").map((c) => c.title)).toEqual(["Rated 10"]);
    expect(filterFilms(cards, "review").map((c) => c.title)).toEqual(["Rated 9 by stars, 7 by review"]);
    expect(filterFilms(april, "top")).toHaveLength(5);
  });
});

describe("starsLabel", () => {
  it("shows Letterboxd stars with a half, and nothing when unrated", () => {
    expect(starsLabel(4.5)).toBe("★★★★½");
    expect(starsLabel(5)).toBe("★★★★★");
    expect(starsLabel(0.5)).toBe("½");
    expect(starsLabel(null)).toBeNull();
  });
});

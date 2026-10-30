import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLetterboxd, type FilmLogInput } from "@/lib/sync/letterboxd";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

const feed = (items: string) =>
  `<?xml version="1.0"?><rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org"><channel><title>t</title>${items}</channel></rss>`;

afterEach(() => vi.restoreAllMocks());

// Review Focus 1: messy Letterboxd entries each give one correct row.
describe("parseLetterboxd: edge fixture", () => {
  const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  const parse = () => {
    warn();
    const items = parseLetterboxd(fixture("letterboxd-edge.xml"));
    return { items, byGuid: (n: number) => items.find((i) => i.letterboxdGuid.endsWith(String(n)))! };
  };

  it("(a) unrated: no memberRating gives null stars and rating", () => {
    const a = parse().byGuid(9000000001);
    expect(a).toEqual<FilmLogInput>({
      letterboxdGuid: "letterboxd-watch-9000000001",
      entryType: "WATCH",
      title: "Yojimbo",
      year: 1961,
      tmdbId: 11878,
      stars: null,
      rating: null,
      watchedAt: new Date("2026-10-26T00:00:00.000Z"),
      posterUrl: "https://a.ltrbxd.com/resized/film-poster/yojimbo-0-600-0-900-crop.jpg?v=1",
      rewatch: false,
      liked: false,
      hasLetterboxdReview: false,
      url: "https://letterboxd.com/itsmaday/film/yojimbo/",
    });
  });

  it("(b) ★★★½ is rating 7, and the poster src is entity-decoded", () => {
    const b = parse().byGuid(9000000002);
    expect([b.stars, b.rating]).toEqual([3.5, 7]);
    expect(b.posterUrl).toBe(
      "https://a.ltrbxd.com/resized/film-poster/cries-and-whispers-0-600-0-900-crop.jpg?v=80b1fa11db&k=2",
    );
  });

  it("(c) rewatch and like 'Yes' are true", () => {
    const c = parse().byGuid(9000000003);
    expect([c.rewatch, c.liked, c.stars, c.rating]).toEqual([true, true, 4.5, 9]);
  });

  it("(d) a letterboxd-review- guid is a REVIEW with hasLetterboxdReview, and no img means no poster", () => {
    const d = parse().byGuid(9000000004);
    expect(d.entryType).toBe("REVIEW");
    expect(d.hasLetterboxdReview).toBe(true);
    expect(d.title).toBe("Love & Death");
    expect(d.posterUrl).toBeNull();
  });

  it("(e) the same film on another date is a second, distinct item", () => {
    const { items } = parse();
    const cries = items.filter((i) => i.title === "Cries and Whispers");
    expect(cries.map((i) => [i.letterboxdGuid, i.watchedAt.toISOString().slice(0, 10), i.rating])).toEqual([
      ["letterboxd-watch-9000000002", "2026-10-25", 7],
      ["letterboxd-watch-9000000005", "2026-09-12", 8],
    ]);
  });

  it("(f) an item with no filmYear is skipped with a warning naming its guid", () => {
    const spy = warn();
    const items = parseLetterboxd(fixture("letterboxd-edge.xml"));
    expect(items.map((i) => i.letterboxdGuid)).toEqual([
      "letterboxd-watch-9000000001",
      "letterboxd-watch-9000000002",
      "letterboxd-watch-9000000003",
      "letterboxd-review-9000000004",
      "letterboxd-watch-9000000005",
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain("letterboxd-watch-9000000006");
    expect(String(spy.mock.calls[0][0])).toContain("filmYear");
  });
});

describe("parseLetterboxd: real feed snapshot", () => {
  const items = parseLetterboxd(fixture("letterboxd.xml"));

  it("parses every item with a valid diary date, year and guid", () => {
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items).toHaveLength(50);
    for (const i of items) {
      expect(Number.isNaN(i.watchedAt.getTime())).toBe(false);
      expect(i.watchedAt.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(Number.isInteger(i.year)).toBe(true);
      expect(i.letterboxdGuid).toMatch(/^letterboxd-(watch|review)-\d+$/);
      expect(i.rating === null || (i.rating >= 1 && i.rating <= 10)).toBe(true);
      expect(i.url).toMatch(/^https:\/\/letterboxd\.com\//);
    }
    expect(new Set(items.map((i) => i.letterboxdGuid)).size).toBe(items.length);
  });

  it("maps the first item field by field", () => {
    expect(items[0]).toEqual<FilmLogInput>({
      letterboxdGuid: "letterboxd-watch-1560622682",
      entryType: "WATCH",
      title: "Sawdust and Tinsel",
      year: 1953,
      tmdbId: 47721,
      stars: 3,
      rating: 6,
      watchedAt: new Date("2026-10-28T00:00:00.000Z"),
      posterUrl:
        "https://a.ltrbxd.com/resized/film-poster/1/7/6/9/4/17694-sawdust-and-tinsel-0-600-0-900-crop.jpg?v=0ec7704f34",
      rewatch: false,
      liked: false,
      hasLetterboxdReview: false,
      url: "https://letterboxd.com/itsmaday/film/sawdust-and-tinsel/",
    });
  });

  it("a TV entry (tmdb:tvId, no movieId) has no tmdbId; the review item is a REVIEW", () => {
    expect(items.find((i) => i.title === "The Curse")?.tmdbId).toBeNull();
    const reviews = items.filter((i) => i.entryType === "REVIEW");
    expect(reviews.map((i) => [i.title, i.hasLetterboxdReview])).toEqual([["The Bear", true]]);
  });
});

describe("parseLetterboxd: shapes", () => {
  const item = (guid: string, extra = "") =>
    `<item><title>x</title><link>https://letterboxd.com/itsmaday/film/x/</link><guid isPermaLink="false">${guid}</guid>` +
    `<letterboxd:filmTitle>X</letterboxd:filmTitle><letterboxd:filmYear>2001</letterboxd:filmYear>${extra}<description></description></item>`;

  it("a single item still parses (not collapsed into an object)", () => {
    const items = parseLetterboxd(feed(item("letterboxd-watch-1", "<letterboxd:watchedDate>2026-01-02</letterboxd:watchedDate>")));
    expect(items.map((i) => i.letterboxdGuid)).toEqual(["letterboxd-watch-1"]);
  });

  it("decodes XML entities in text once, numeric references included", () => {
    const [i] = parseLetterboxd(
      feed(
        `<item><link>https://letterboxd.com/itsmaday/film/x/</link><guid>letterboxd-watch-1</guid>` +
          `<letterboxd:filmTitle>Schindler&#039;s List &#x2014; &lt;3 &amp;amp;</letterboxd:filmTitle>` +
          `<letterboxd:filmYear>1993</letterboxd:filmYear><letterboxd:watchedDate>2026-01-02</letterboxd:watchedDate></item>`,
      ),
    );
    expect(i.title).toBe("Schindler's List — <3 &amp;");
  });

  it("an empty channel gives no items", () => {
    expect(parseLetterboxd(feed(""))).toEqual([]);
  });

  it("list items (letterboxd-list- guids) are skipped silently", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseLetterboxd(feed(`<item><title>My list</title><guid>letterboxd-list-77</guid></item>`))).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a missing or impossible watchedDate skips the item with a warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = parseLetterboxd(
      feed(item("letterboxd-watch-1") + item("letterboxd-watch-2", "<letterboxd:watchedDate>2026-02-30</letterboxd:watchedDate>")),
    );
    expect(items).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("a feed that isn't RSS throws", () => {
    expect(() => parseLetterboxd("<html><body>Too many requests</body></html>")).toThrow(/RSS/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SyncShapeError } from "@/lib/sync/errors";
import { parseStatsfm, statsfmUrl } from "@/lib/sync/statsfm";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../fixtures/statsfm-top-albums.json", import.meta.url), "utf8")) as unknown;

const item = (album: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  position: 1,
  streams: 10,
  album: { id: 1, name: "Album", image: "https://cdn.stats.fm/a.jpg", artists: [{ name: "Artist" }], releaseDate: 0, ...album },
  ...extra,
});

describe("statsfmUrl", () => {
  it("asks for the last 7 days in milliseconds, 6 albums", () => {
    const url = new URL(statsfmUrl("maday", new Date("2026-10-29T13:10:00Z")));
    expect(url.origin + url.pathname).toBe("https://api.stats.fm/api/v1/users/maday/top/albums");
    expect(url.searchParams.get("after")).toBe("1792674600000");
    expect(url.searchParams.get("before")).toBe("1793279400000");
    expect(url.searchParams.get("limit")).toBe("6");
  });

  it("escapes the user", () => {
    expect(statsfmUrl("a/b c", new Date(0))).toContain("/users/a%2Fb%20c/top/albums");
  });
});

describe("parseStatsfm", () => {
  it("parses the real response into 6 albums with title, artist, year and cover", () => {
    const albums = parseStatsfm(fixture());
    expect(albums).toHaveLength(6);
    for (const a of albums) {
      expect(a.title).not.toBe("");
      expect(a.artist).not.toBe("");
      expect(a.coverUrl).toMatch(/^https:\/\//);
      expect(a.year).toBeGreaterThan(1900);
    }
    expect(albums.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(albums[0]).toEqual({
      statsfmAlbumId: "59524021",
      title: "LUX",
      artist: "ROSALÍA",
      year: 2025,
      coverUrl: expect.stringMatching(/^https:\/\/is1-ssl\.mzstatic\.com\//),
      rank: 1,
      streams: 50,
    });
  });

  it("joins several artists and drops 'Various Artists' when real names are listed", () => {
    const whiplash = parseStatsfm(fixture()).find((a) => a.title.startsWith("Whiplash"));
    expect(whiplash?.artist).toBe("Justin Hurwitz");
    const [a] = parseStatsfm({ items: [item({ artists: [{ name: "Kid Cudi" }, { name: "Kanye West" }] })] });
    expect(a.artist).toBe("Kid Cudi, Kanye West");
  });

  it("an album with no artists (a soundtrack) shows 'Various Artists'", () => {
    const laLaLand = parseStatsfm(fixture()).find((a) => a.title.startsWith("La La Land"));
    expect(laLaLand?.artist).toBe("Various Artists");
  });

  it("a missing or non-https cover is '', a missing release date gives no year", () => {
    const [a, b, c] = parseStatsfm({
      items: [
        item({ image: "http://insecure.example/a.jpg", releaseDate: null }),
        item({ image: null }, { position: 2 }),
        item({ image: undefined, releaseDate: undefined }, { position: 3 }),
      ],
    });
    expect([a.coverUrl, a.year]).toEqual(["", null]);
    expect([b.coverUrl, c.coverUrl, c.year]).toEqual(["", "", null]);
  });

  it("an empty week parses to no albums", () => {
    expect(parseStatsfm({ items: [] })).toEqual([]);
  });

  it.each([
    ["items is not a list", { items: "nope" }],
    ["no items", {}],
    ["null", null],
    ["an error body", { message: "User not found" }],
    ["an album without a name", { items: [item({ name: "" })] }],
    ["an album without an id", { items: [item({ id: undefined })] }],
    ["a position that isn't a number", { items: [item({}, { position: "1" })] }],
  ])("throws SyncShapeError when %s", (_, json) => {
    expect(() => parseStatsfm(json)).toThrow(SyncShapeError);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getMusic } from "@/lib/queries/music";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged read directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

beforeEach(resetDb);

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("getMusic", () => {
  it("rotation is the top 6 listens by rank", async () => {
    const window = { windowStart: day("2026-10-22"), windowEnd: day("2026-10-29") };
    await db.albumListen.createMany({
      data: [7, 3, 1, 2, 6, 5, 4].map((rank) => ({
        id: `l${rank}`,
        statsfmAlbumId: `s${rank}`,
        title: `Album ${rank}`,
        artist: "Artist",
        year: rank === 1 ? 2024 : null,
        coverUrl: rank === 1 ? "https://cdn.stats.fm/1.jpg" : "",
        rank,
        streams: 100 - rank,
        ...window,
      })),
    });
    const { rotation } = await getMusic();
    expect(rotation.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rotation[0]).toEqual({
      id: "l1",
      title: "Album 1",
      artist: "Artist",
      year: 2024,
      coverUrl: "https://cdn.stats.fm/1.jpg",
      rank: 1,
    });
    expect(rotation[1].coverUrl).toBeNull();
  });

  it("rated albums by rating, then date, then id; a post only when published", async () => {
    const album = (id: string, title: string, rating: number, date: string) =>
      db.review.create({ data: { id, kind: "ALBUM", title, artist: "A", year: 2020, rating, date: day(date) } });
    await album("r-b", "Tie B", 9, "2025-05-01");
    await album("r-a", "Tie A", 9, "2025-05-01");
    await album("r-old10", "Old ten", 10, "2024-01-01");
    await album("r-new9", "Newer nine", 9, "2025-09-01");
    await db.review.create({ data: { kind: "FOOD", title: "Not music", rating: 10, date: day("2026-01-01") } });
    const post = (slug: string, reviewId: string, status: "DRAFT" | "PUBLISHED") =>
      db.post.create({
        data: { slug, title: slug, excerpt: "", blocks: [], html: "", category: "MUSIC", status, readingMinutes: 1, reviewId },
      });
    await post("old-ten", "r-old10", "PUBLISHED");
    await post("draft", "r-new9", "DRAFT");

    const { rated } = await getMusic();
    expect(rated.map((r) => r.id)).toEqual(["r-old10", "r-new9", "r-a", "r-b"]);
    expect(rated[0]).toEqual({
      id: "r-old10",
      title: "Old ten",
      artist: "A",
      year: 2020,
      rating: 10,
      coverUrl: null,
      postSlug: "old-ten",
    });
    expect(rated[1].postSlug).toBeNull();
  });

  it("concerts newest first, then by id", async () => {
    const concert = (id: string, artist: string, date: string) =>
      db.review.create({
        data: { id, kind: "CONCERT", title: artist, artist, venue: "Greek Theatre", highlight: "the encore", rating: 8, date: day(date) },
      });
    await concert("c-b", "Same night B", "2025-10-04");
    await concert("c-a", "Same night A", "2025-10-04");
    await concert("c-old", "Older", "2024-03-14");
    await concert("c-new", "Newest", "2026-03-14");

    const { concerts } = await getMusic();
    expect(concerts.map((c) => c.id)).toEqual(["c-new", "c-a", "c-b", "c-old"]);
    expect(concerts[0]).toEqual({
      id: "c-new",
      artist: "Newest",
      venue: "Greek Theatre",
      date: "2026-03-14",
      highlight: "the encore",
      rating: 8,
    });
  });

  it("is empty with no music", async () => {
    await expect(getMusic()).resolves.toEqual({ rotation: [], rated: [], concerts: [] });
  });
});

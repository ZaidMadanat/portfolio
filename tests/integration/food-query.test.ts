import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getPlaces } from "@/lib/queries/food";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged read directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

beforeEach(resetDb);

const food = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) =>
  db.review.create({
    data: {
      id,
      kind: "FOOD",
      title,
      rating: 8,
      date: new Date(`${date}T00:00:00.000Z`),
      address: "1 Main St",
      lat: 37.8,
      lng: -122.27,
      cuisine: "Thai",
      price: 2,
      neighbourhood: "Downtown",
      city: "Berkeley",
      region: "EAST_BAY",
      ...extra,
    },
  });

describe("getPlaces", () => {
  it("returns food reviews newest first, the same day ordered by id, with dishes in order", async () => {
    await food("c-b", "Same day B", "2026-05-01");
    await food("c-a", "Same day A", "2026-05-01");
    await food("c-old", "Older", "2025-01-02");
    await food("c-new", "Newest", "2026-06-30");
    await db.review.create({ data: { kind: "FILM", title: "A film", rating: 9, date: new Date("2026-07-01") } });
    await db.dish.createMany({
      data: [
        { reviewId: "c-new", name: "Second", mustOrder: false, order: 1 },
        { reviewId: "c-new", name: "First", mustOrder: true, order: 0 },
      ],
    });

    const places = await getPlaces();
    expect(places.map((p) => p.id)).toEqual(["c-new", "c-a", "c-b", "c-old"]);
    expect(places[0]).toEqual({
      id: "c-new",
      name: "Newest",
      cuisine: "Thai",
      price: 2,
      neighbourhood: "Downtown",
      city: "Berkeley",
      region: "EAST_BAY",
      rating: 8,
      lat: 37.8,
      lng: -122.27,
      date: "2026-06-30",
      dishes: [
        { name: "First", mustOrder: true },
        { name: "Second", mustOrder: false },
      ],
      photos: [],
      postSlug: null,
    });
  });

  it("links only a published post, sizes photos in order, and skips places with no map position", async () => {
    await food("c-1", "Linked", "2026-05-01");
    await food("c-2", "Draft post", "2026-04-01");
    await food("c-3", "No pin", "2026-03-01", { lat: null, lng: null });
    const post = (slug: string, reviewId: string, status: "DRAFT" | "PUBLISHED") =>
      db.post.create({
        data: { slug, title: slug, excerpt: "", blocks: [], html: "", category: "FOOD", status, readingMinutes: 1, reviewId },
      });
    await post("linked-post", "c-1", "PUBLISHED");
    await post("draft-post", "c-2", "DRAFT");
    for (const [id, order] of [["m2", 1], ["m1", 0]] as const) {
      await db.media.create({
        data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: `${id}.jpg`, width: 2400, height: 1600, bytes: 1 },
      });
      await db.reviewMedia.create({ data: { reviewId: "c-1", mediaId: id, order } });
    }

    const places = await getPlaces();
    expect(places.map((p) => [p.id, p.postSlug])).toEqual([
      ["c-1", "linked-post"],
      ["c-2", null],
    ]);
    expect(places[0].photos).toEqual(["/uploads/media/m1/960.webp", "/uploads/media/m2/960.webp"]);
  });

  it("is empty with no food reviews", async () => {
    await expect(getPlaces()).resolves.toEqual([]);
  });
});

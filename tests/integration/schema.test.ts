import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

beforeEach(resetDb);

const foodReview = {
  kind: "FOOD" as const,
  title: "La Taqueria",
  rating: 9,
  date: new Date("2026-04-01"),
  cuisine: "Mexican",
  price: 1,
  city: "San Francisco",
  region: "SAN_FRANCISCO" as const,
};

describe("schema", () => {
  it("links a post to a FOOD review and returns its dishes in order", async () => {
    const review = await db.review.create({
      data: {
        ...foodReview,
        dishes: {
          create: [
            { name: "Carne asada taco", mustOrder: false, order: 2 },
            { name: "Carnitas super burrito", mustOrder: true, order: 1 },
          ],
        },
      },
    });
    await db.post.create({
      data: {
        slug: "la-taqueria",
        title: "La Taqueria",
        blocks: [],
        category: "FOOD",
        reviewId: review.id,
      },
    });

    const post = await db.post.findUniqueOrThrow({
      where: { slug: "la-taqueria" },
      include: { review: { include: { dishes: { orderBy: { order: "asc" } } } } },
    });
    expect(post.status).toBe("DRAFT");
    expect(post.review?.dishes.map((d) => d.name)).toEqual([
      "Carnitas super burrito",
      "Carne asada taco",
    ]);
    expect(post.review?.dishes[0].mustOrder).toBe(true);
  });

  it("rejects a review rating outside 1–10 (DB check)", async () => {
    await expect(db.review.create({ data: { ...foodReview, rating: 11 } })).rejects.toThrow();
    await expect(db.review.create({ data: { ...foodReview, rating: 0 } })).rejects.toThrow();
    await expect(db.review.create({ data: { ...foodReview, rating: 10 } })).resolves.toBeTruthy();
  });

  it("rejects a second Favorite in the same (kind, position)", async () => {
    await db.favorite.create({ data: { kind: "FILM", position: 1, title: "Ben-Hur" } });
    await expect(
      db.favorite.create({ data: { kind: "FILM", position: 1, title: "Lolita" } }),
    ).rejects.toThrow();
    await expect(
      db.favorite.create({ data: { kind: "ALBUM", position: 1, title: "Blonde" } }),
    ).resolves.toBeTruthy();
  });

  it("upserts FilmLog by letterboxdGuid idempotently", async () => {
    const data = {
      letterboxdGuid: "letterboxd-watch-123",
      entryType: "WATCH" as const,
      title: "Ben-Hur",
      year: 1959,
      stars: 5,
      rating: 10,
      watchedAt: new Date("2026-04-26"),
      url: "https://letterboxd.com/itsMaday/film/ben-hur-1959/",
    };
    for (let i = 0; i < 2; i++) {
      await db.filmLog.upsert({
        where: { letterboxdGuid: data.letterboxdGuid },
        create: data,
        update: data,
      });
    }
    const logs = await db.filmLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].stars?.toString()).toBe("5");
    expect(logs[0].rating).toBe(10);
  });

  it("clears Post.reviewId when the linked review is deleted", async () => {
    const review = await db.review.create({ data: { ...foodReview } });
    await db.post.create({
      data: { slug: "p", title: "P", blocks: [], category: "FOOD", reviewId: review.id },
    });
    await db.review.delete({ where: { id: review.id } });
    const post = await db.post.findUniqueOrThrow({ where: { slug: "p" } });
    expect(post.reviewId).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { seed } from "../../prisma/seed";
import { resetDb } from "./reset";

beforeEach(resetDb);

describe("seed", () => {
  it("upserts the 7 built-in templates idempotently and adds no fixtures by default", async () => {
    await seed(db, { fixtures: false });
    await seed(db, { fixtures: false });

    const templates = await db.template.findMany({ orderBy: { name: "asc" } });
    expect(templates.map((t) => t.name)).toEqual([
      "Album review",
      "Concert review",
      "Essay",
      "Film review",
      "Notes / cheat sheet",
      "Project write-up",
      "Restaurant review",
    ]);
    expect(templates.every((t) => t.builtIn && t.category && Array.isArray(t.blocks))).toBe(true);
    expect(await db.post.count()).toBe(0);
    expect(await db.filmLog.count()).toBe(0);
  });

  it("adds the dev fixtures idempotently with SEED_FIXTURES", async () => {
    await seed(db, { fixtures: true });
    await seed(db, { fixtures: true });

    const logs = await db.filmLog.findMany({ orderBy: { watchedAt: "desc" } });
    expect(logs).toHaveLength(12);
    const yojimbo = logs.find((l) => l.title === "Yojimbo");
    expect(yojimbo?.stars).toBeNull();
    expect(yojimbo?.rating).toBeNull();
    expect(logs.find((l) => l.title === "The Aviator")?.rating).toBe(9);

    const places = await db.review.findMany({ where: { kind: "FOOD" }, include: { dishes: true } });
    expect(places).toHaveLength(8);
    expect(places.every((p) => p.lat != null && p.lng != null && p.region && p.dishes.length)).toBe(
      true,
    );

    const posts = await db.post.findMany({ include: { review: true } });
    expect(posts).toHaveLength(8);
    expect(posts.every((p) => p.html.length > 0)).toBe(true);
    const linked = posts.filter((p) => p.review);
    expect(linked.map((p) => [p.review?.kind, p.review?.title])).toEqual([["FILM", "Ben-Hur"]]);

    const benHurReview = await db.review.findFirstOrThrow({
      where: { kind: "FILM" },
      include: { filmLog: true },
    });
    expect(benHurReview.filmLog?.title).toBe("Ben-Hur");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The review admin's reads (list, form options, a saved review back into the
// form) and "Write one now" (spec §7 Reviews), against the test database.

const admin = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/require-admin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/require-admin")>();
  return {
    ...real,
    requireAdmin: async () => {
      if (!admin.signedIn) throw new real.AdminAuthError();
      return { userId: "u1" };
    },
  };
});
vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T>(fn: T) => fn }));

const { listAdminReviews, getReviewFormOptions, getReviewFormState, parseReviewKind, REVIEW_TEMPLATE_IDS } = await import("@/lib/admin/reviews");
const { startReviewPost } = await import("@/app/admin/reviews/actions");
const { BASE_CUISINES } = await import("@/lib/cuisines");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
});

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

async function foodReview(id: string, extra: Record<string, unknown> = {}) {
  return db.review.create({
    data: {
      id,
      kind: "FOOD",
      title: id,
      rating: 8,
      date: day("2026-10-01"),
      address: "1 Main St",
      lat: 37.8,
      lng: -122.3,
      cuisine: "Burmese",
      price: 2,
      neighbourhood: "Inner Richmond",
      city: "San Francisco",
      region: "SAN_FRANCISCO",
      ...extra,
    },
  });
}

async function filmLog(id: string, title: string, watchedAt: string, stars: number | null) {
  return db.filmLog.create({
    data: {
      id,
      letterboxdGuid: `letterboxd-watch-${id}`,
      entryType: "WATCH",
      title,
      year: 2004,
      stars,
      rating: stars === null ? null : Math.round(stars * 2),
      watchedAt: day(watchedAt),
      url: `https://letterboxd.com/x/film/${id}/`,
    },
  });
}

async function post(id: string, extra: Record<string, unknown> = {}) {
  return db.post.create({ data: { id, slug: id, title: id, blocks: [], html: "", category: "FOOD", ...extra } });
}

async function seedTemplates() {
  for (const [kind, id] of Object.entries(REVIEW_TEMPLATE_IDS)) {
    await db.template.create({
      data: {
        id,
        name: `${kind} review`,
        builtIn: true,
        category: kind === "FOOD" ? "FOOD" : kind === "FILM" ? "FILM" : "MUSIC",
        blocks: [{ type: "heading", props: { level: 2 }, content: "The verdict" }],
      },
    });
  }
}

describe("parseReviewKind", () => {
  it("accepts a kind in any case and rejects anything else", () => {
    expect(parseReviewKind("FOOD")).toBe("FOOD");
    expect(parseReviewKind("concert")).toBe("CONCERT");
    expect(parseReviewKind(["film", "x"])).toBe("FILM");
    expect(parseReviewKind("other")).toBeNull();
    expect(parseReviewKind(undefined)).toBeNull();
  });
});

describe("listAdminReviews", () => {
  it("lists newest first with a total order, counts per kind, and filters", async () => {
    await foodReview("b-food");
    await foodReview("a-food");
    await db.review.create({ data: { id: "c-concert", kind: "CONCERT", title: "Khruangbin", artist: "Khruangbin", venue: "Greek Theatre", rating: 9, date: day("2026-10-20") } });
    await db.review.create({ data: { id: "d-album", kind: "ALBUM", title: "GNX", artist: "Kendrick Lamar", year: 2024, rating: 7, date: day("2026-09-01") } });
    await db.review.updateMany({ data: { createdAt: new Date("2026-10-02T00:00:00Z") } });
    await post("p1", { reviewId: "a-food", title: "A long review" });

    const all = await listAdminReviews(null);
    expect(all.rows.map((r) => r.id)).toEqual(["c-concert", "b-food", "a-food", "d-album"]);
    expect(all.counts).toEqual({ all: 4, FOOD: 2, FILM: 0, ALBUM: 1, CONCERT: 1 });
    const a = all.rows.find((r) => r.id === "a-food")!;
    expect(a).toMatchObject({ kind: "FOOD", rating: 8, meta: "Burmese · $$ · Inner Richmond, San Francisco", post: { id: "p1", title: "A long review" } });
    expect(all.rows.find((r) => r.id === "c-concert")!.meta).toBe("Greek Theatre");
    expect(all.rows.find((r) => r.id === "d-album")!.meta).toBe("Kendrick Lamar · 2024");

    const food = await listAdminReviews("FOOD");
    expect(food.rows.map((r) => r.id)).toEqual(["b-food", "a-food"]);
    expect(food.counts.all).toBe(4);
  });
});

describe("getReviewFormOptions", () => {
  it("offers recent film logs with their /10 rating, marking ones another review uses", async () => {
    await filmLog("log-old", "Old", "2026-04-01", 3);
    await filmLog("log-new", "The Aviator", "2026-04-24", 4.5);
    await filmLog("log-unrated", "Yojimbo", "2026-04-26", null);
    await db.review.create({ data: { id: "r-film", kind: "FILM", title: "Old", rating: 6, date: day("2026-04-02"), filmLogId: "log-old" } });

    const { filmLogs } = await getReviewFormOptions(null);
    expect(filmLogs.map((l) => [l.id, l.rating, l.reviewed, l.watchedAt])).toEqual([
      ["log-unrated", null, false, "2026-04-26"],
      ["log-new", 9, false, "2026-04-24"],
      ["log-old", 6, true, "2026-04-01"],
    ]);
    expect(filmLogs[1].label).toBe("The Aviator (2004) · Apr 24 · 9/10");
    expect(filmLogs[0].label).toBe("Yojimbo (2004) · Apr 26 · no rating");
    expect(filmLogs[2].label).toBe("Old (2004) · Apr 1 · 6/10 · has a review");

    // Editing that review: its own log is free to pick.
    const editing = await getReviewFormOptions("r-film");
    expect(editing.filmLogs.find((l) => l.id === "log-old")!.reviewed).toBe(false);
  });

  it("offers the stats.fm window by rank, unlinked posts, and the cuisines used so far", async () => {
    const windowStart = new Date("2026-10-20T00:00:00Z");
    const windowEnd = new Date("2026-10-27T00:00:00Z");
    for (const [i, title] of ["Blonde", "GNX"].entries()) {
      await db.albumListen.create({
        data: { id: `l${i}`, statsfmAlbumId: `s${i}`, title, artist: "A", year: i ? null : 2016, coverUrl: "", rank: 2 - i, streams: 1, windowStart, windowEnd },
      });
    }
    await foodReview("r1", { cuisine: "Georgian" });
    await foodReview("r2", { cuisine: "burmese" });
    await foodReview("r3", { cuisine: "Afghan" });
    await post("free", { title: "Free post", updatedAt: new Date("2026-10-01T00:00:00Z") });
    await post("draft", { title: "", status: "DRAFT" });
    await post("taken", { title: "Taken", reviewId: "r2" });
    await post("mine", { title: "Mine", status: "PUBLISHED", reviewId: "r1" });

    const options = await getReviewFormOptions("r1");
    expect(options.albums.map((a) => [a.id, a.title, a.year, a.statsfmAlbumId])).toEqual([
      ["l1", "GNX", null, "s1"],
      ["l0", "Blonde", 2016, "s0"],
    ]);
    expect(options.posts.map((p) => p.id).sort()).toEqual(["draft", "free", "mine"]);
    expect(options.posts.find((p) => p.id === "draft")!.label).toBe("Untitled draft (draft)");
    expect(options.posts.find((p) => p.id === "mine")!.label).toBe("Mine");
    expect(options.cuisines).toEqual([...BASE_CUISINES, "Afghan", "Georgian"]);
    expect((await getReviewFormOptions(null)).posts.map((p) => p.id).sort()).toEqual(["draft", "free"]);
  });
});

describe("getReviewFormState", () => {
  it("loads a food review with its dishes and photos in order and its linked post", async () => {
    await foodReview("r1", { region: "PENINSULA", city: "Pacifica" });
    await db.dish.createMany({
      data: [
        { reviewId: "r1", name: "Second", mustOrder: false, order: 1 },
        { reviewId: "r1", name: "First", mustOrder: true, order: 0 },
      ],
    });
    for (const id of ["m2", "m1"]) {
      await db.media.create({ data: { id, blobUrl: `/uploads/media/${id}/1600.webp`, filename: `${id}.jpg`, width: 1600, height: 1000, bytes: 1 } });
    }
    await db.reviewMedia.createMany({ data: [{ reviewId: "r1", mediaId: "m2", order: 1 }, { reviewId: "r1", mediaId: "m1", order: 0 }] });
    await post("p1", { reviewId: "r1" });

    const state = (await getReviewFormState("r1"))!;
    expect(state.kind).toBe("FOOD");
    expect(state.shared).toEqual({
      rating: 8,
      date: "2026-10-01",
      photos: [
        { id: "m1", url: "/uploads/media/m1/960.webp" },
        { id: "m2", url: "/uploads/media/m2/960.webp" },
      ],
      postId: "p1",
    });
    expect(state.food).toMatchObject({ title: "r1", lat: "37.8", lng: "-122.3", city: "Pacifica", region: "PENINSULA", regionTouched: true, price: 2, cuisine: "Burmese" });
    expect(state.food.dishes).toEqual([
      { key: "k1", name: "First", mustOrder: true },
      { key: "k2", name: "Second", mustOrder: false },
    ]);
  });

  it("loads film, album and concert fields; null for an unknown id", async () => {
    await filmLog("log1", "The Aviator", "2026-04-24", 4.5);
    await db.review.create({ data: { id: "f", kind: "FILM", title: "The Aviator", rating: 9, date: day("2026-04-24"), filmLogId: "log1" } });
    await db.review.create({ data: { id: "a", kind: "ALBUM", title: "GNX", artist: "Kendrick Lamar", year: 2024, coverUrl: "https://x.test/c.jpg", statsfmAlbumId: "s9", rating: 7, date: day("2026-09-01") } });
    await db.review.create({ data: { id: "c", kind: "CONCERT", title: "Khruangbin", artist: "Khruangbin", venue: "Greek Theatre", highlight: "Encore", rating: 9, date: day("2026-10-20") } });

    expect((await getReviewFormState("f"))!.film).toEqual({ filmLogId: "log1", title: "The Aviator", year: "2004" });
    expect((await getReviewFormState("a"))!.album).toEqual({ listenId: "", title: "GNX", artist: "Kendrick Lamar", year: "2024", coverUrl: "https://x.test/c.jpg", statsfmAlbumId: "s9" });
    expect((await getReviewFormState("c"))!.concert).toEqual({ artist: "Khruangbin", venue: "Greek Theatre", highlight: "Encore" });
    expect(await getReviewFormState("nope")).toBeNull();
  });
});

describe("startReviewPost (Write one now)", () => {
  it("creates a draft from the kind's template, linked to the review and named after it", async () => {
    await seedTemplates();
    await db.review.create({ data: { id: "c", kind: "CONCERT", title: "Khruangbin", artist: "Khruangbin", venue: "Greek Theatre", rating: 9, date: day("2026-10-20") } });

    const result = await startReviewPost("c");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const draft = await db.post.findUniqueOrThrow({ where: { id: result.postId } });
    expect(draft).toMatchObject({ status: "DRAFT", reviewId: "c", templateId: REVIEW_TEMPLATE_IDS.CONCERT, title: "Khruangbin", slug: "khruangbin", category: "MUSIC" });
    expect(draft.blocks).toEqual([{ type: "heading", props: { level: 2 }, content: "The verdict" }]);

    // A second click opens the same post instead of making another.
    expect(await startReviewPost("c")).toEqual({ ok: true, postId: result.postId });
    expect(await db.post.count()).toBe(1);
  });

  it("refuses an unknown review and needs the admin", async () => {
    expect(await startReviewPost("nope")).toEqual({ ok: false, message: expect.stringContaining("no longer exists") });
    admin.signedIn = false;
    await expect(startReviewPost("nope")).rejects.toThrow();
    expect(await db.post.count()).toBe(0);
  });
});

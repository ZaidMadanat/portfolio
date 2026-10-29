import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getKeepReading, getPostBySlug, getPublishedPosts, getRedirectSlugs } from "@/lib/queries/posts";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged reads directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

beforeEach(resetDb);

const base = { blocks: [], html: "<p>Hi</p>", excerpt: "An excerpt" };

async function tag(postId: string, ...names: string[]) {
  for (const name of names) {
    const t = await db.tag.upsert({ where: { name }, create: { name }, update: {} });
    await db.postTag.create({ data: { postId, tagId: t.id } });
  }
}

describe("getPublishedPosts", () => {
  it("lists published posts newest first with label, tags, year and the linked rating; never drafts", async () => {
    const review = await db.review.create({
      data: { kind: "FILM", title: "Ben-Hur", rating: 10, date: new Date("2026-04-26") },
    });
    const older = await db.post.create({
      data: {
        ...base,
        slug: "older",
        title: "Older",
        category: "COMPUTER_SCIENCE",
        status: "PUBLISHED",
        // Jan 1 03:00 UTC is still Dec 31 in Berkeley.
        publishedAt: new Date("2026-01-01T03:00:00.000Z"),
        readingMinutes: 7,
      },
    });
    await tag(older.id, "web", "next.js");
    await db.post.create({
      data: {
        ...base,
        slug: "newer",
        title: "Newer",
        category: "FILM",
        status: "PUBLISHED",
        publishedAt: new Date("2026-04-27T19:00:00.000Z"),
        reviewId: review.id,
      },
    });
    await db.post.create({ data: { ...base, slug: "draft", title: "Draft", category: "NOTES" } });

    const posts = await getPublishedPosts();
    expect(posts.map((p) => p.slug)).toEqual(["newer", "older"]);
    expect(posts[0]).toMatchObject({ category: "Film", rating: 10, tags: [], year: "2026" });
    expect(posts[1]).toEqual({
      id: older.id,
      slug: "older",
      title: "Older",
      excerpt: "An excerpt",
      category: "Computer Science",
      tags: ["next.js", "web"],
      publishedAt: "2026-01-01T03:00:00.000Z",
      year: "2025",
      readingMinutes: 7,
      rating: null,
    });
  });

  it("returns an empty list for an empty database", async () => {
    expect(await getPublishedPosts()).toEqual([]);
  });
});

async function publish(slug: string, extra: Record<string, unknown> = {}) {
  return db.post.create({
    data: {
      ...base,
      slug,
      title: slug,
      category: "FILM",
      status: "PUBLISHED",
      publishedAt: new Date("2026-04-27T19:00:00.000Z"),
      ...extra,
    },
  });
}

describe("getPostBySlug", () => {
  it("returns the post with its rating box when it's linked to a review", async () => {
    const log = await db.filmLog.create({
      data: {
        letterboxdGuid: "letterboxd-watch-1",
        entryType: "WATCH",
        title: "Ben-Hur",
        year: 1959,
        stars: 5,
        rating: 10,
        watchedAt: new Date("2026-04-26T00:00:00.000Z"),
        posterUrl: "https://a.ltrbxd.com/ben-hur.jpg",
        url: "https://letterboxd.com/itsMaday/film/ben-hur-1959/",
      },
    });
    const review = await db.review.create({
      data: { kind: "FILM", title: "Ben-Hur", rating: 10, date: new Date("2026-04-26"), filmLogId: log.id },
    });
    const post = await publish("ben-hur", { reviewId: review.id, html: "<p>Body</p>" });
    await tag(post.id, "epics");

    const result = await getPostBySlug("ben-hur");
    expect(result && "post" in result).toBe(true);
    if (!result || !("post" in result)) return;
    expect(result.post).toMatchObject({ id: post.id, slug: "ben-hur", html: "<p>Body</p>", tags: ["epics"], rating: 10 });
    expect(result.post.review).toEqual({
      kind: "FILM",
      title: "Ben-Hur (1959)",
      meta: "Watched Apr 26, 2026",
      rating: 10,
      imageUrl: "https://a.ltrbxd.com/ben-hur.jpg",
      href: "/reviews/film",
    });
  });

  it("gives a photo in the rating box the library's alt text, else a description of the place", async () => {
    const photo = async (reviewId: string, id: string, alt: string) => {
      await db.media.create({
        data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: "IMG_0001.jpg", width: 2400, height: 1600, bytes: 1, alt },
      });
      await db.reviewMedia.create({ data: { reviewId, mediaId: id, order: 0 } });
    };
    const withAlt = await db.review.create({
      data: { kind: "FOOD", title: "La Taqueria", rating: 9, date: new Date("2026-03-14"), city: "San Francisco" },
    });
    await photo(withAlt.id, "m-alt", "A carnitas burrito cut in half");
    await publish("burritos", { reviewId: withAlt.id, category: "FOOD" });
    const noAlt = await db.review.create({
      data: { kind: "FOOD", title: "Comal", rating: 8, date: new Date("2026-03-01"), city: "Berkeley" },
    });
    await photo(noAlt.id, "m-blank", "");
    await publish("comal", { reviewId: noAlt.id, category: "FOOD" });

    const box = async (slug: string) => {
      const r = await getPostBySlug(slug);
      return r && "post" in r ? r.post.review : undefined;
    };
    expect(await box("burritos")).toMatchObject({
      imageUrl: "/uploads/media/m-alt/2400.webp",
      imageAlt: "A carnitas burrito cut in half",
    });
    expect(await box("comal")).toMatchObject({ imageUrl: "/uploads/media/m-blank/2400.webp", imageAlt: "Photo at Comal" });
  });

  it("drops the rating box, without throwing, once the linked review is deleted (Review Focus 5)", async () => {
    const review = await db.review.create({
      data: { kind: "FOOD", title: "La Taqueria", rating: 9, date: new Date("2026-03-14"), cuisine: "Mexican", price: 1, neighbourhood: "Mission", city: "San Francisco" },
    });
    await publish("burritos", { reviewId: review.id, category: "FOOD" });
    const before = await getPostBySlug("burritos");
    expect(before && "post" in before && before.post.review).toMatchObject({
      kind: "FOOD",
      title: "La Taqueria",
      meta: "Mexican · $ · Mission, San Francisco",
      href: "/reviews/food",
    });

    await db.review.delete({ where: { id: review.id } });

    const after = await getPostBySlug("burritos");
    expect(after && "post" in after).toBe(true);
    if (!after || !("post" in after)) return;
    expect(after.post.review).toBeNull();
    expect(after.post.rating).toBeNull();
  });

  it("sends an old slug to the current one", async () => {
    const post = await publish("new-slug");
    await db.redirect.create({ data: { fromSlug: "old-slug", postId: post.id } });
    expect(await getPostBySlug("old-slug")).toEqual({ redirectTo: "/blog/new-slug" });
  });

  it("returns null for an unknown slug, a draft, and a redirect to a draft", async () => {
    const draft = await db.post.create({ data: { ...base, slug: "draft", title: "Draft", category: "NOTES" } });
    await db.redirect.create({ data: { fromSlug: "old-draft", postId: draft.id } });
    const live = await publish("live");
    await db.redirect.create({ data: { fromSlug: "old-live", postId: live.id } });
    // Only old slugs of published posts are prerendered.
    expect(await getRedirectSlugs()).toEqual(["old-live"]);
    expect(await getPostBySlug("nope")).toBeNull();
    expect(await getPostBySlug("draft")).toBeNull();
    expect(await getPostBySlug("old-draft")).toBeNull();
  });
});

describe("getKeepReading", () => {
  it("prefers two posts from the same category, then fills with the most recent", async () => {
    const day = (d: string) => new Date(`2026-${d}T19:00:00.000Z`);
    const current = await publish("current", { category: "FILM", publishedAt: day("04-20") });
    await publish("film-old", { category: "FILM", publishedAt: day("01-01") });
    await publish("film-new", { category: "FILM", publishedAt: day("03-01") });
    await publish("film-third", { category: "FILM", publishedAt: day("02-01") });
    await publish("notes-latest", { category: "NOTES", publishedAt: day("04-25") });

    const same = await getKeepReading({ id: current.id, category: "Film" });
    expect(same.map((p) => p.slug)).toEqual(["film-new", "film-third"]);

    const onlyOne = await getKeepReading({ id: current.id, category: "Notes" });
    expect(onlyOne.map((p) => p.slug)).toEqual(["notes-latest", "film-new"]);
  });

  it("returns nothing when the post is the only one", async () => {
    const only = await publish("only");
    expect(await getKeepReading({ id: only.id, category: "Film" })).toEqual([]);
  });
});

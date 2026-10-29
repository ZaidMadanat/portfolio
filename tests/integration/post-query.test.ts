import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getPublishedPosts } from "@/lib/queries/posts";
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

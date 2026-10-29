import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The post editor's server actions (spec §7, §7.2, §7.3) against the test
// database, with the admin check stubbed and Next's cache calls spied on.

const admin = vi.hoisted(() => ({ signedIn: true }));
const cache = vi.hoisted(() => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));

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
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

const { deletePost, publishPost, savePost, saveAsTemplate, unpublishPost } = await import("@/app/admin/posts/actions");
const { createDraft } = await import("@/lib/admin/posts");
const { mediaUsage } = await import("@/lib/admin/media-library");
const { getLikes, getViews, likePost, recordView } = await import("@/lib/counters");
const { getStore, resetMemoryStore } = await import("@/lib/redis");

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  resetMemoryStore();
  admin.signedIn = true;
  cache.updateTag.mockClear();
  cache.revalidateTag.mockClear();
});

const paragraph = (text: string) => ({ type: "paragraph", content: text });
const image = (id: string) => ({ type: "image", props: { url: `/uploads/media/${id}/960.webp`, name: "IMG_1.jpg" } });

const input = (extra: Record<string, unknown> = {}) => ({
  title: "Hypothesis testing",
  blocks: [paragraph("Every test starts the same way.")],
  category: "STATISTICS" as const,
  tags: [] as string[],
  reviewId: null,
  ...extra,
});

async function draft(slug = "untitled") {
  return db.post.create({ data: { slug, title: "", blocks: [], category: "NOTES" } });
}

async function published(slug: string) {
  return db.post.create({
    data: { slug, title: "Old title", blocks: [], category: "NOTES", status: "PUBLISHED", publishedAt: new Date("2026-10-01T12:00:00Z") },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const tagsOf = async (postId: string) =>
  (await db.postTag.findMany({ where: { postId }, select: { tag: { select: { name: true } } } })).map((t) => t.tag.name).sort();

describe("savePost", () => {
  it("normalises tags: lower-cased, trimmed, # stripped, no duplicates", async () => {
    const post = await draft();
    await savePost(post.id, input({ tags: ["#Probability", " probability ", "Cheat-Sheet"] }));
    expect(await tagsOf(post.id)).toEqual(["cheat-sheet", "probability"]);
    // Saving again replaces the set.
    await savePost(post.id, input({ tags: ["probability"] }));
    expect(await tagsOf(post.id)).toEqual(["probability"]);
  });

  it("renders html, reading time and a default excerpt, and derives a draft's slug from its title", async () => {
    const post = await draft();
    const result = await savePost(post.id, input({ blocks: [paragraph("Every test starts the same way."), { type: "math", props: { latex: "z = \\frac{x}{y}" } }] }));
    const row = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.html).toContain("Every test starts the same way.");
    expect(row.html).toContain('class="katex"');
    expect(row).toMatchObject({ title: "Hypothesis testing", slug: "hypothesis-testing", category: "STATISTICS", readingMinutes: 1, excerpt: "Every test starts the same way." });
    expect(result).toEqual({ slug: "hypothesis-testing", readingMinutes: 1, excerpt: "Every test starts the same way." });
  });

  it("keeps slugs unique", async () => {
    await published("hypothesis-testing");
    const post = await draft();
    expect((await savePost(post.id, input())).slug).toBe("hypothesis-testing-2");
  });

  it("writes a Redirect when a published post's slug changes, and not for a draft", async () => {
    const post = await published("old-slug");
    await savePost(post.id, input({ slug: "New Slug!" }));
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).slug).toBe("new-slug");
    expect(await db.redirect.findMany({ select: { fromSlug: true, postId: true } })).toEqual([{ fromSlug: "old-slug", postId: post.id }]);

    // Renaming back to the old slug drops that redirect and records the other.
    await savePost(post.id, input({ slug: "old-slug" }));
    expect(await db.redirect.findMany({ select: { fromSlug: true } })).toEqual([{ fromSlug: "new-slug" }]);

    const d = await draft("draft-slug");
    await savePost(d.id, input({ title: "Something else", slug: "renamed-draft" }));
    expect(await db.redirect.count({ where: { postId: d.id } })).toBe(0);
  });

  it("keeps a published post's slug when no slug is sent", async () => {
    const post = await published("old-slug");
    expect((await savePost(post.id, input({ title: "A brand new title" }))).slug).toBe("old-slug");
  });

  it("turns library image blocks into PostMedia rows and keeps them in step", async () => {
    for (const id of ["m1", "m2"]) {
      await db.media.create({ data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: `${id}.jpg`, width: 2400, height: 1600, bytes: 1, alt: `Alt ${id}` } });
    }
    const post = await draft();
    await savePost(post.id, input({ blocks: [image("m1"), image("m2"), image("missing")] }));
    const media = async () => (await db.postMedia.findMany({ where: { postId: post.id }, select: { mediaId: true } })).map((m) => m.mediaId).sort();
    expect(await media()).toEqual(["m1", "m2"]);
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).html).toContain('alt="Alt m1"');

    await savePost(post.id, input({ blocks: [image("m2")] }));
    expect(await media()).toEqual(["m2"]);
  });

  it("expires the public tags only for a published post", async () => {
    const d = await draft();
    await savePost(d.id, input());
    expect(cache.updateTag).not.toHaveBeenCalled();

    const post = await published("live");
    await savePost(post.id, input());
    expect(cache.updateTag.mock.calls).toEqual([["posts"], [`post:${post.id}`], ["rss"], ["home"]]);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("links a review only once", async () => {
    const review = await db.review.create({ data: { kind: "FILM", title: "Ben-Hur", rating: 10, date: new Date() } });
    const a = await draft("a");
    const b = await draft("b");
    await savePost(a.id, input({ reviewId: review.id }));
    await expect(savePost(b.id, input({ title: "Other", reviewId: review.id }))).rejects.toThrow("review-taken");
    expect((await db.post.findUniqueOrThrow({ where: { id: a.id } })).reviewId).toBe(review.id);
  });

  it("refuses without an admin session and writes nothing", async () => {
    const post = await draft();
    admin.signedIn = false;
    await expect(savePost(post.id, input())).rejects.toThrow("Admin session required");
    await expect(publishPost(post.id)).rejects.toThrow("Admin session required");
    await expect(unpublishPost(post.id)).rejects.toThrow("Admin session required");
    await expect(saveAsTemplate(post.id, "Mine")).rejects.toThrow("Admin session required");
    const row = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(row).toMatchObject({ title: "", slug: "untitled", status: "DRAFT" });
    expect(await db.template.count()).toBe(0);
  });
});

describe("publishPost / unpublishPost", () => {
  async function confirmed(n: number) {
    await db.subscriber.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        email: `reader${i}@example.com`,
        status: "CONFIRMED" as const,
        confirmToken: `c${i}`,
        unsubscribeToken: `u${i}`,
        confirmedAt: new Date(),
      })),
    });
  }

  it("publishes, queues the new-post email once, and keeps the first publish date", async () => {
    await confirmed(2);
    const post = await draft();
    await savePost(post.id, input());
    await publishPost(post.id);
    const first = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(first.status).toBe("PUBLISHED");
    expect(first.publishedAt).toBeInstanceOf(Date);
    expect(await db.emailSend.count({ where: { postId: post.id } })).toBe(2);
    expect(cache.updateTag.mock.calls).toEqual([["posts"], [`post:${post.id}`], ["rss"], ["home"]]);

    await unpublishPost(post.id);
    const down = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(down.status).toBe("DRAFT");
    expect(down.publishedAt).toEqual(first.publishedAt);

    await publishPost(post.id);
    expect(await db.emailSend.count({ where: { postId: post.id } })).toBe(2);
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).publishedAt).toEqual(first.publishedAt);
  });

  it("won't publish a post without a title", async () => {
    const post = await draft();
    await expect(publishPost(post.id)).rejects.toThrow("title-required");
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("DRAFT");
  });

  it("also expires the reviews hub when the post is linked to a review", async () => {
    const review = await db.review.create({ data: { kind: "FILM", title: "Ben-Hur", rating: 10, date: new Date() } });
    const post = await draft();
    await savePost(post.id, input({ reviewId: review.id }));
    await publishPost(post.id);
    expect(cache.updateTag.mock.calls.map((c) => c[0])).toEqual(["posts", `post:${post.id}`, "rss", "home", "reviews", `review:${review.id}`, "home"]);
  });
});

describe("templates", () => {
  it("creates a draft pre-filled from a template", async () => {
    const template = await db.template.create({
      data: { name: "Notes / cheat sheet", builtIn: true, category: "NOTES", blocks: [{ type: "heading", props: { level: 2 }, content: "Summary" }] },
    });
    const post = await createDraft(template.id);
    expect(post).toMatchObject({ title: "", slug: "untitled", category: "NOTES", templateId: template.id, status: "DRAFT" });
    expect(post.blocks).toEqual(template.blocks);
    expect(post.html).toContain("Summary");
    expect((await createDraft(null)).slug).toBe("untitled-2");
    expect((await createDraft("no-such-template")).templateId).toBeNull();
  });

  it("gives drafts created at the same moment different slugs", async () => {
    const drafts = await Promise.all([createDraft(null), createDraft(null), createDraft(null)]);
    expect(new Set(drafts.map((d) => d.slug)).size).toBe(3);
  });

  it("saves a post as a new user template", async () => {
    const post = await draft();
    await savePost(post.id, input());
    const t = await saveAsTemplate(post.id, "  Stat notes  ");
    expect(await db.template.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({
      name: "Stat notes",
      builtIn: false,
      category: "STATISTICS",
      blocks: [paragraph("Every test starts the same way.")],
    });
  });
});

describe("deletePost", () => {
  const photo = (id: string) =>
    db.media.create({ data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: `${id}.jpg`, width: 2400, height: 1600, bytes: 1, alt: `Alt ${id}` } });

  /** A published post with everything that hangs off it: review, photos, tags, an old slug, an email, counters. */
  async function fullPost() {
    await photo("m1");
    await photo("cover");
    const review = await db.review.create({ data: { kind: "FILM", title: "Ben-Hur", rating: 8, date: new Date("2026-10-01") } });
    const post = await published("old-slug");
    await savePost(post.id, input({ title: "Ben-Hur", slug: "ben-hur", reviewId: review.id, coverMediaId: "cover", tags: ["film"], blocks: [image("m1")] }));
    const reader = await db.subscriber.create({ data: { email: "r@example.com", status: "CONFIRMED", confirmToken: "c", unsubscribeToken: "u" } });
    await db.emailSend.create({ data: { postId: post.id, subscriberId: reader.id, status: "SENT", sentAt: new Date() } });
    await db.postStat.create({ data: { postId: post.id, views: 3, likes: 1, syncedAt: new Date() } });
    await db.postStatDaily.create({ data: { postId: post.id, day: new Date("2026-10-28"), views: 3, likes: 1 } });
    const store = getStore();
    await recordView(store, post.id);
    await likePost(store, post.id, "vid-1", "s");
    cache.updateTag.mockClear();
    return { post, review, reader };
  }

  it("deletes the post and its rows, keeps the review (unlinked), the photos and the subscriber", async () => {
    const { post, review, reader } = await fullPost();
    const other = await published("other");
    expect(await db.redirect.count({ where: { postId: post.id } })).toBe(1);

    await deletePost(post.id);

    expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull();
    for (const count of [
      db.postMedia.count({ where: { postId: post.id } }),
      db.redirect.count({ where: { postId: post.id } }),
      db.emailSend.count({ where: { postId: post.id } }),
      db.postStat.count({ where: { postId: post.id } }),
      db.postStatDaily.count({ where: { postId: post.id } }),
      db.postTag.count({ where: { postId: post.id } }),
    ]) {
      expect(await count).toBe(0);
    }
    // The review stays, now without a post; the photos stay and show as unused.
    expect(await db.review.findUniqueOrThrow({ where: { id: review.id }, select: { post: { select: { id: true } } } })).toEqual({ post: null });
    expect(await mediaUsage("m1")).toEqual([]);
    expect(await mediaUsage("cover")).toEqual([]);
    expect(await db.subscriber.findUnique({ where: { id: reader.id } })).not.toBeNull();
    expect(await db.post.findUnique({ where: { id: other.id } })).not.toBeNull();
    // Its counters are gone too.
    const store = getStore();
    expect(await getViews(store, post.id)).toBe(0);
    expect(await getLikes(store, post.id, "vid-1", "s")).toEqual({ count: 0, liked: false });
  });

  it("expires the post's tags at once, plus the reviews hub when it was linked to a review", async () => {
    const { post, review } = await fullPost();
    await deletePost(post.id);
    expect(cache.updateTag.mock.calls.map((c) => c[0])).toEqual(["posts", `post:${post.id}`, "rss", "home", "reviews", `review:${review.id}`, "home"]);
    expect(cache.revalidateTag).not.toHaveBeenCalled();

    cache.updateTag.mockClear();
    const plain = await draft("plain");
    await deletePost(plain.id);
    expect(cache.updateTag.mock.calls).toEqual([["posts"], [`post:${plain.id}`], ["rss"], ["home"]]);
  });

  it("does nothing for an unknown id", async () => {
    await expect(deletePost("nope")).resolves.toBeUndefined();
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("refuses without an admin session and deletes nothing", async () => {
    const post = await published("kept");
    admin.signedIn = false;
    await expect(deletePost(post.id)).rejects.toThrow();
    expect(await db.post.findUnique({ where: { id: post.id } })).not.toBeNull();
    expect(cache.updateTag).not.toHaveBeenCalled();
  });
});

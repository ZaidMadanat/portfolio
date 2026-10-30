import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The photo library's server actions (spec §7) against the test database, with
// the admin check stubbed, Next's cache calls spied on and the store mocked.

const admin = vi.hoisted(() => ({ signedIn: true }));
const cache = vi.hoisted(() => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));
const store = vi.hoisted(() => ({ remove: vi.fn<(id: string) => Promise<void>>(async () => {}) }));

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
vi.mock("@/lib/media/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/media/store")>();
  return { ...real, getMediaStore: () => ({ kind: "local", put: vi.fn(), remove: store.remove }) };
});

const { deleteMedia, updateAlt, usageOf } = await import("@/app/admin/media/actions");
const { renderPostBlocks } = await import("@/lib/blocks/post-html");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
  cache.updateTag.mockClear();
  cache.revalidateTag.mockClear();
  store.remove.mockClear();
});

async function media(id: string, alt = "") {
  return db.media.create({
    data: { id, blobUrl: `/uploads/media/${id}/2400.webp`, filename: `${id}.jpg`, width: 2400, height: 1600, bytes: 1000, alt },
  });
}

const imageBlocks = (id: string) => [
  { type: "paragraph", content: "Lunch first." },
  { type: "image", props: { url: `/uploads/media/${id}/960.webp`, name: "IMG_0042.jpg", caption: "Carnitas" } },
];

async function post(slug: string, blocks: unknown[], extra: Record<string, unknown> = {}) {
  const { html, mediaIds } = await renderPostBlocks(blocks);
  return db.post.create({
    data: {
      slug,
      title: slug,
      blocks: blocks as object[],
      html,
      category: "FOOD",
      media: { create: mediaIds.map((mediaId) => ({ mediaId })) },
      ...extra,
    },
  });
}

describe("deleteMedia", () => {
  it("throws in-use for a photo a post uses, and keeps it", async () => {
    await media("m1");
    await post("tacos", imageBlocks("m1"));
    await expect(deleteMedia("m1")).rejects.toThrow("in-use");
    expect(await db.media.count()).toBe(1);
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("throws in-use for a review photo or a post cover", async () => {
    await media("m1");
    await media("m2");
    const review = await db.review.create({ data: { kind: "FOOD", title: "La Taqueria", rating: 9, date: new Date() } });
    await db.reviewMedia.create({ data: { reviewId: review.id, mediaId: "m1" } });
    await post("cover", [], { coverMediaId: "m2" });
    await expect(deleteMedia("m1")).rejects.toThrow("in-use");
    await expect(deleteMedia("m2")).rejects.toThrow("in-use");
    expect(await db.media.count()).toBe(2);
  });

  it("removes an unused photo's row and every stored size", async () => {
    await media("m1");
    await media("keep");
    await deleteMedia("m1");
    expect(await db.media.findMany({ select: { id: true } })).toEqual([{ id: "keep" }]);
    expect(store.remove).toHaveBeenCalledWith("m1");
  });
});

describe("updateAlt", () => {
  it("re-renders the html of every post using the photo and expires their tags", async () => {
    await media("m1");
    await media("m2");
    const uses = await post("tacos", imageBlocks("m1"), { status: "PUBLISHED", publishedAt: new Date() });
    const other = await post("other", imageBlocks("m2"));
    expect(uses.html).toContain('alt=""');
    expect(uses.html).not.toContain("IMG_0042");

    const result = await updateAlt("m1", "  A carnitas burrito, cut in half  ");
    expect(result).toEqual({ alt: "A carnitas burrito, cut in half", postsUpdated: 1 });

    expect((await db.media.findUniqueOrThrow({ where: { id: "m1" } })).alt).toBe("A carnitas burrito, cut in half");
    const html = (await db.post.findUniqueOrThrow({ where: { id: uses.id } })).html;
    expect(html).toContain('alt="A carnitas burrito, cut in half"');
    expect(html).toContain("Lunch first.");
    expect((await db.post.findUniqueOrThrow({ where: { id: other.id } })).html).toBe(other.html);

    expect(cache.updateTag.mock.calls).toEqual([[`post:${uses.id}`]]);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects alt text over 500 characters", async () => {
    await media("m1");
    await expect(updateAlt("m1", "x".repeat(501))).rejects.toThrow();
    expect((await db.media.findUniqueOrThrow({ where: { id: "m1" } })).alt).toBe("");
  });
});

describe("usageOf", () => {
  it("labels every post, draft, cover and review that uses a photo", async () => {
    await media("m1");
    const review = await db.review.create({ data: { kind: "FOOD", title: "La Taqueria", rating: 9, date: new Date() } });
    await db.reviewMedia.create({ data: { reviewId: review.id, mediaId: "m1" } });
    await post("ben-hur", imageBlocks("m1"), {
      title: "Ben-Hur at sixty-seven: still the biggest film I've seen on a laptop",
      status: "PUBLISHED",
      publishedAt: new Date(),
    });
    await post("notes", [], { title: "Stat 135 notes", coverMediaId: "m1" });

    expect(await usageOf("m1")).toEqual([
      "Post: Ben-Hur at sixty-seven: still the biggest film…",
      "Draft: Stat 135 notes (cover)",
      "Review: La Taqueria",
    ]);
  });

  it("says when a photo isn't used yet", async () => {
    await media("m1");
    expect(await usageOf("m1")).toEqual(["Not used yet"]);
  });
});

describe("without an admin session", () => {
  it("every action refuses before touching anything", async () => {
    await media("m1", "Old alt");
    admin.signedIn = false;
    await expect(updateAlt("m1", "New alt")).rejects.toThrow("Admin session required");
    await expect(deleteMedia("m1")).rejects.toThrow("Admin session required");
    await expect(usageOf("m1")).rejects.toThrow("Admin session required");
    expect((await db.media.findUniqueOrThrow({ where: { id: "m1" } })).alt).toBe("Old alt");
    expect(store.remove).not.toHaveBeenCalled();
  });
});

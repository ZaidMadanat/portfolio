import { describe, expect, it, vi } from "vitest";

const unstable_cache = vi.fn((fn: () => Promise<unknown>) => fn);
vi.mock("next/cache", () => ({ unstable_cache, revalidateTag: vi.fn() }));

const { TAGS, cached } = await import("@/lib/cache");

describe("TAGS", () => {
  it("builds the tag names", () => {
    expect(TAGS.posts).toBe("posts");
    expect(TAGS.post("p1")).toBe("post:p1");
    expect(TAGS.review("r1")).toBe("review:r1");
    expect([TAGS.rss, TAGS.home, TAGS.reviews, TAGS.films, TAGS.music]).toEqual([
      "rss",
      "home",
      "reviews",
      "films",
      "music",
    ]);
  });
});

describe("cached", () => {
  it("wraps unstable_cache with the key and tags, no time-based revalidation", async () => {
    const read = cached(async () => 42, ["posts", "home"], "home-posts");
    expect(unstable_cache).toHaveBeenCalledWith(expect.any(Function), ["home-posts"], {
      tags: ["posts", "home"],
      revalidate: false,
    });
    await expect(read()).resolves.toBe(42);
  });
});

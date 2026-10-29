import { afterEach, describe, expect, it, vi } from "vitest";

const unstable_cache = vi.fn((fn: () => Promise<unknown>) => fn);
vi.mock("next/cache", () => ({ unstable_cache, revalidateTag: vi.fn() }));

const { TAGS, cached } = await import("@/lib/cache");

afterEach(() => {
  vi.unstubAllEnvs();
  unstable_cache.mockClear();
});

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
  it("wraps unstable_cache with the key, the build key and tags, no time-based revalidation", async () => {
    vi.stubEnv("CACHE_BUILD_KEY", "build-abc");
    const read = cached(async () => 42, ["posts", "home"], "home-posts");
    expect(unstable_cache).toHaveBeenCalledWith(expect.any(Function), ["home-posts", "build:build-abc"], {
      tags: ["posts", "home"],
      revalidate: false,
    });
    await expect(read()).resolves.toBe(42);
  });

  it("gives each build its own entries, so a rebuild never reuses the last build's data", () => {
    vi.stubEnv("CACHE_BUILD_KEY", "build-1");
    cached(async () => 1, ["home"], "home:lately");
    vi.stubEnv("CACHE_BUILD_KEY", "build-2");
    cached(async () => 1, ["home"], "home:lately");
    const [first, second] = unstable_cache.mock.calls.map((call) => (call as unknown[])[1]);
    expect(first).not.toEqual(second);
  });

  it("still works without a build key (vitest, tsx scripts)", () => {
    vi.stubEnv("CACHE_BUILD_KEY", undefined);
    cached(async () => 1, ["home"], "home:lately");
    expect((unstable_cache.mock.calls[0] as unknown[])[1]).toEqual(["home:lately", "build:dev"]);
  });
});

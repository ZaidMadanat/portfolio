import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: vi.fn() }));

const { revalidateFor, tagsFor } = await import("@/lib/revalidate");

// Spec §7.3.
describe("tagsFor", () => {
  it("post write", () => {
    expect(tagsFor("post", { postId: "p1" })).toEqual(["posts", "post:p1", "rss", "home"]);
  });

  it("review write, linked to a post", () => {
    expect(tagsFor("review", { reviewId: "r1", postId: "p1" })).toEqual([
      "reviews",
      "review:r1",
      "home",
      "post:p1",
    ]);
  });

  it("review write, not linked", () => {
    expect(tagsFor("review", { reviewId: "r1" })).toEqual(["reviews", "review:r1", "home"]);
  });

  it("favourites change", () => {
    expect(tagsFor("favorites")).toEqual(["reviews"]);
  });

  it("media alt-text change hits every post using it", () => {
    expect(tagsFor("mediaAlt", { postIds: ["p1", "p2"] })).toEqual(["post:p1", "post:p2"]);
    expect(tagsFor("mediaAlt", { postIds: [] })).toEqual([]);
    expect(tagsFor("mediaAlt")).toEqual([]);
  });

  it("sync runs", () => {
    expect(tagsFor("letterboxd")).toEqual(["films", "home", "reviews"]);
    expect(tagsFor("statsfm")).toEqual(["music", "home"]);
    expect(tagsFor("strava")).toEqual(["home"]);
  });
});

describe("revalidateFor", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
  });

  it("revalidates each tag with the max profile", () => {
    revalidateFor("review", { reviewId: "r1", postId: "p1" });
    expect(revalidateTag.mock.calls).toEqual([
      ["reviews", "max"],
      ["review:r1", "max"],
      ["home", "max"],
      ["post:p1", "max"],
    ]);
  });
});

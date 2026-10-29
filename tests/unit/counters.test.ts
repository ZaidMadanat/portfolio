import { describe, expect, it } from "vitest";
import * as counters from "@/lib/counters";
import {
  getLikes,
  getViews,
  likePost,
  recordView,
  visitorHash,
} from "@/lib/counters";
import { memoryStore } from "@/lib/redis";

const SECRET = "test-secret";

describe("likes (add-only)", () => {
  it("counts the same visitor once", async () => {
    const store = memoryStore();
    await likePost(store, "p1", "vid-a", SECRET);
    const res = await likePost(store, "p1", "vid-a", SECRET);
    expect(res).toEqual({ count: 1, liked: true });
  });

  it("counts different visitors separately", async () => {
    const store = memoryStore();
    await likePost(store, "p1", "vid-a", SECRET);
    expect(await likePost(store, "p1", "vid-b", SECRET)).toEqual({ count: 2, liked: true });
  });

  it("keeps posts independent", async () => {
    const store = memoryStore();
    await likePost(store, "p1", "vid-a", SECRET);
    expect(await getLikes(store, "p2", "vid-a", SECRET)).toEqual({ count: 0, liked: false });
  });

  it("reports liked state per visitor", async () => {
    const store = memoryStore();
    await likePost(store, "p1", "vid-a", SECRET);
    expect(await getLikes(store, "p1", "vid-a", SECRET)).toEqual({ count: 1, liked: true });
    expect(await getLikes(store, "p1", "vid-b", SECRET)).toEqual({ count: 1, liked: false });
    expect(await getLikes(store, "p1", null, SECRET)).toEqual({ count: 1, liked: false });
  });

  it("stores hashes, never the raw vid", async () => {
    const store = memoryStore();
    await likePost(store, "p1", "vid-a", SECRET);
    expect(await store.sismember("likes:p1", "vid-a")).toBe(false);
    expect(await store.sismember("likes:p1", await visitorHash("vid-a", SECRET))).toBe(true);
  });

  it("exports no way to unlike", () => {
    const names = Object.keys(counters);
    expect(names).not.toContain("unlikePost");
    expect(names.some((n) => /unlike|srem|remove/i.test(n))).toBe(false);
  });
});

describe("views", () => {
  it("increments on every recordView", async () => {
    const store = memoryStore();
    await recordView(store, "p1");
    await recordView(store, "p1");
    expect(await recordView(store, "p1")).toBe(3);
    expect(await getViews(store, "p1")).toBe(3);
  });

  it("is 0 for an unseen post", async () => {
    expect(await getViews(memoryStore(), "nope")).toBe(0);
  });
});

describe("visitorHash", () => {
  it("is hex HMAC-SHA256, stable per (vid, secret)", async () => {
    const h = await visitorHash("vid-a", SECRET);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await visitorHash("vid-a", SECRET)).toBe(h);
  });

  it("changes with the secret", async () => {
    expect(await visitorHash("vid-a", "s1")).not.toBe(await visitorHash("vid-a", "s2"));
  });

  it("matches a known HMAC-SHA256 vector", async () => {
    // RFC 4231 test case 2.
    expect(await visitorHash("what do ya want for nothing?", "Jefe")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

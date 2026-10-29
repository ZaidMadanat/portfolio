import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

// No UPSTASH_* env in tests, so the routes use the shared memoryStore.
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("LIKE_SECRET", "route-secret");

const likes = await import("@/app/api/likes/[postId]/route");
const views = await import("@/app/api/views/[postId]/route");
const { resetMemoryStore } = await import("@/lib/redis");

const VID = "8f14e45f-ceea-467f-a0e6-b8c5e4a1d2f3";
const ctx = (postId: string) => ({ params: Promise.resolve({ postId }) });
const req = (path: string, method = "GET", vid?: string) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: vid ? { cookie: `vid=${vid}` } : {},
  });

beforeEach(() => resetMemoryStore());

describe("proxy", () => {
  it("only matches the counter APIs", () => {
    expect(config.matcher).toEqual(["/api/likes/:path*", "/api/views/:path*"]);
  });

  it("issues a vid cookie when missing and forwards it to the route", () => {
    const res = proxy(req("/api/likes/p1"));
    const set = res.cookies.get("vid");
    expect(set?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(set?.httpOnly).toBe(true);
    expect(set?.sameSite).toBe("lax");
    expect(set?.path).toBe("/");
    expect(set?.maxAge).toBe(60 * 60 * 24 * 365);
    // The same request sees the new cookie, so the first like counts.
    expect(res.headers.get("x-middleware-request-cookie")).toContain(`vid=${set?.value}`);
  });

  it("leaves a valid vid alone", () => {
    const res = proxy(req("/api/likes/p1", "GET", VID));
    expect(res.cookies.get("vid")).toBeUndefined();
  });

  it("replaces a malformed vid", () => {
    const res = proxy(req("/api/likes/p1", "GET", "not-a-uuid"));
    expect(res.cookies.get("vid")?.value).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("/api/likes/[postId]", () => {
  it("likes once per visitor and reports liked state", async () => {
    const first = await likes.POST(req("/api/likes/p1", "POST", VID), ctx("p1"));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({ count: 1, liked: true });

    await likes.POST(req("/api/likes/p1", "POST", VID), ctx("p1"));
    const got = await likes.GET(req("/api/likes/p1", "GET", VID), ctx("p1"));
    expect(got.headers.get("cache-control")).toBe("no-store");
    expect(await got.json()).toEqual({ count: 1, liked: true });

    const other = await likes.GET(req("/api/likes/p1"), ctx("p1"));
    expect(await other.json()).toEqual({ count: 1, liked: false });
  });

  it("rejects a like without a vid", async () => {
    const res = await likes.POST(req("/api/likes/p1", "POST"), ctx("p1"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid post id", async () => {
    const res = await likes.GET(req("/api/likes/x"), ctx("bad id!"));
    expect(res.status).toBe(400);
  });

  it("has no DELETE handler", () => {
    expect(Object.keys(likes)).not.toContain("DELETE");
  });
});

describe("/api/views/[postId]", () => {
  it("POST increments, GET reads", async () => {
    await views.POST(req("/api/views/p1", "POST"), ctx("p1"));
    const res = await views.POST(req("/api/views/p1", "POST"), ctx("p1"));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ count: 2 });
    const got = await views.GET(req("/api/views/p1"), ctx("p1"));
    expect(await got.json()).toEqual({ count: 2 });
  });
});

describe("likeSecret", () => {
  it("is required on Vercel", async () => {
    const { likeSecret } = await import("@/lib/counter-api");
    vi.stubEnv("LIKE_SECRET", "");
    vi.stubEnv("VERCEL", "1");
    expect(() => likeSecret()).toThrow("LIKE_SECRET is not set");
    vi.stubEnv("VERCEL", "");
    expect(likeSecret()).toBe("dev-only-like-secret");
    vi.stubEnv("LIKE_SECRET", "route-secret");
  });
});

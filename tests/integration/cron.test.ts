import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { recordView, likePost } from "@/lib/counters";
import { getStore, resetMemoryStore } from "@/lib/redis";
import { resetDb } from "./reset";

// Task 32: the cron routes, the SyncRun log, housekeeping and "Run sync now".
// Every outside call goes through a stubbed global fetch; nothing here may
// reach Letterboxd, stats.fm or Strava.

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

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

const { withSyncRun } = await import("@/lib/sync/record-run");
const { runSync } = await import("@/lib/sync/run");
const { runSyncNow } = await import("@/app/admin/actions");
const { getMusic } = await import("@/lib/queries/music");
const routes = {
  letterboxd: await import("@/app/api/cron/letterboxd/route"),
  statsfm: await import("@/app/api/cron/statsfm/route"),
  strava: await import("@/app/api/cron/strava/route"),
  housekeeping: await import("@/app/api/cron/housekeeping/route"),
};

const SECRET = "test-cron-secret-0123456789";
const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

/** Stubs the global fetch; `serve` answers by URL. Returns the mock to inspect calls. */
function stubFetch(serve: (url: string) => Response | Promise<Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => serve(String(input instanceof Request ? input.url : input)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const cronRequest = (name: string, auth?: string) =>
  new Request(`http://localhost/api/cron/${name}`, auth === undefined ? {} : { headers: { Authorization: auth } });

async function seedRotation() {
  await db.albumListen.createMany({
    data: [1, 2, 3].map((rank) => ({
      id: `old${rank}`,
      statsfmAlbumId: `s${rank}`,
      title: `Old album ${rank}`,
      artist: "Old artist",
      year: 2020,
      coverUrl: "",
      rank,
      streams: 10,
      windowStart: new Date("2026-10-15T00:00:00Z"),
      windowEnd: new Date("2026-10-22T00:00:00Z"),
    })),
  });
}

beforeEach(async () => {
  await resetDb();
  resetMemoryStore();
  cache.revalidateTag.mockClear();
  cache.updateTag.mockClear();
  admin.signedIn = true;
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("STRAVA_ALLOW_LOCAL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("withSyncRun", () => {
  it("records a successful run: startedAt, finishedAt, ok, message and itemsChanged", async () => {
    const run = await withSyncRun("LETTERBOXD", async () => ({ itemsChanged: 4, message: "4 new logs" }));
    expect(run).toMatchObject({ source: "LETTERBOXD", ok: true, message: "4 new logs", itemsChanged: 4 });
    const row = await db.syncRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row).toMatchObject({ ok: true, message: "4 new logs", itemsChanged: 4 });
    expect(row.finishedAt!.getTime()).toBeGreaterThanOrEqual(row.startedAt.getTime());
  });

  it("never throws: a failure is recorded with the error's message", async () => {
    const run = await withSyncRun("STATSFM", async () => {
      throw new Error("stats.fm responded 500");
    });
    expect(run).toMatchObject({ source: "STATSFM", ok: false, message: "stats.fm responded 500", itemsChanged: 0 });
    expect(await db.syncRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({
      ok: false,
      message: "stats.fm responded 500",
    });
  });

  it("never throws, even for a thrown non-Error or a database that's down", async () => {
    await expect(withSyncRun("STRAVA", () => Promise.reject("plain string"))).resolves.toMatchObject({
      ok: false,
      message: "plain string",
    });
    vi.spyOn(db.syncRun, "create").mockRejectedValueOnce(new Error("connection refused"));
    const fn = vi.fn(async () => ({ itemsChanged: 1 }));
    await expect(withSyncRun("LETTERBOXD", fn)).resolves.toMatchObject({ ok: false, message: expect.stringMatching(/connection refused/) });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("cron routes", () => {
  it.each(Object.keys(routes) as (keyof typeof routes)[])("%s: a missing or wrong bearer gets 401 and runs nothing", async (name) => {
    const fetch = stubFetch(() => new Response("should not be called", { status: 500 }));
    for (const auth of [undefined, "", `Bearer wrong`, `bearer ${SECRET}`, SECRET, `Bearer ${SECRET}x`, `Basic ${SECRET}`]) {
      const res = await routes[name].GET(cronRequest(name, auth));
      expect(res.status, `auth ${auth}`).toBe(401);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.syncRun.count()).toBe(0);
  });

  it("refuses everyone when CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const fetch = stubFetch(() => new Response("", { status: 500 }));
    for (const auth of ["Bearer ", "Bearer undefined", "Bearer"]) {
      expect((await routes.statsfm.GET(cronRequest("statsfm", auth))).status).toBe(401);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("routes are Node, force-dynamic and GET only", () => {
    for (const route of Object.values(routes)) {
      expect(route.runtime).toBe("nodejs");
      expect(route.dynamic).toBe("force-dynamic");
      expect(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k))).toEqual(["GET"]);
    }
  });

  it("letterboxd: the right bearer syncs, logs the run and returns {ok, itemsChanged}", async () => {
    stubFetch(() => new Response(fixture("letterboxd.xml")));
    const res = await routes.letterboxd.GET(cronRequest("letterboxd", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, itemsChanged: 50 });
    expect(await db.filmLog.count()).toBe(50);
    expect(await db.syncRun.findFirstOrThrow()).toMatchObject({ source: "LETTERBOXD", ok: true, itemsChanged: 50 });
    // Cron context: stale-while-revalidate, never updateTag.
    expect(cache.revalidateTag).toHaveBeenCalledWith("films", "max");
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  // Review Focus 4: a failing source keeps the previous data on the site.
  it("statsfm failing: 200 {ok:false}, a SyncRun ok=false row, and the music page keeps the previous rows", async () => {
    await seedRotation();
    stubFetch(() => new Response("upstream down", { status: 500 }));
    const res = await routes.statsfm.GET(cronRequest("statsfm", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, itemsChanged: 0 });

    const run = await db.syncRun.findFirstOrThrow();
    expect(run).toMatchObject({ source: "STATSFM", ok: false, itemsChanged: 0 });
    expect(run.message).toMatch(/500/);
    expect(run.finishedAt).toBeInstanceOf(Date);

    expect((await getMusic()).rotation.map((a) => a.title)).toEqual(["Old album 1", "Old album 2", "Old album 3"]);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("statsfm with a bad shape is logged the same way", async () => {
    await seedRotation();
    stubFetch(() => Response.json({ items: "nope" }));
    const res = await routes.statsfm.GET(cronRequest("statsfm", `Bearer ${SECRET}`));
    expect(await res.json()).toEqual({ ok: false, itemsChanged: 0 });
    expect((await db.syncRun.findFirstOrThrow()).message).toMatch(/unexpected response/);
    expect(await db.albumListen.count()).toBe(3);
  });

  it("strava locally: the guard refuses before any request, and the run is logged ok=false", async () => {
    const fetch = stubFetch(() => new Response("must not be called", { status: 500 }));
    const res = await routes.strava.GET(cronRequest("strava", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, itemsChanged: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.syncRun.findFirstOrThrow()).toMatchObject({
      source: "STRAVA",
      ok: false,
      message: expect.stringMatching(/only on Vercel/),
    });
    expect(await db.providerToken.count()).toBe(0);
  });

  it("housekeeping copies the counters into PostStat and today's snapshot, then drains the email queue", async () => {
    const post = await db.post.create({
      data: { slug: "p", title: "P", blocks: [], category: "NOTES", status: "PUBLISHED", publishedAt: new Date() },
    });
    const store = getStore();
    for (let i = 0; i < 3; i++) await recordView(store, post.id);
    await likePost(store, post.id, "vid-1", "s");
    const reader = await db.subscriber.create({
      data: { email: "r@example.com", status: "CONFIRMED", confirmToken: "c", unsubscribeToken: "u" },
    });
    await db.emailSend.create({ data: { postId: post.id, subscriberId: reader.id } });

    const res = await routes.housekeeping.GET(cronRequest("housekeeping", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    // 1 post's counters changed + 1 email sent.
    expect(await res.json()).toEqual({ ok: true, itemsChanged: 2 });

    expect(await db.postStat.findUniqueOrThrow({ where: { postId: post.id } })).toMatchObject({ views: 3, likes: 1 });
    expect(await db.postStatDaily.findFirstOrThrow({ where: { postId: post.id } })).toMatchObject({ views: 3, likes: 1 });
    expect(await db.emailSend.findFirstOrThrow()).toMatchObject({ status: "SENT" });
    expect(await db.syncRun.findFirstOrThrow()).toMatchObject({ source: "HOUSEKEEPING", ok: true, itemsChanged: 2 });
  });
});

describe("runSync", () => {
  it("dispatches each source and returns the recorded run", async () => {
    stubFetch(() => new Response(fixture("letterboxd.xml")));
    const run = await runSync("LETTERBOXD");
    expect(run).toMatchObject({ source: "LETTERBOXD", ok: true, itemsChanged: 50 });
    expect(await db.syncRun.count()).toBe(1);
  });

  it("a failing counter copy doesn't stop the email drain, and the run is ok=false", async () => {
    const post = await db.post.create({
      data: { slug: "p", title: "P", blocks: [], category: "NOTES", status: "PUBLISHED", publishedAt: new Date() },
    });
    const reader = await db.subscriber.create({
      data: { email: "r@example.com", status: "CONFIRMED", confirmToken: "c", unsubscribeToken: "u" },
    });
    await db.emailSend.create({ data: { postId: post.id, subscriberId: reader.id } });
    // The counter copy starts by listing posts; make that fail once.
    vi.spyOn(db.post, "findMany").mockRejectedValueOnce(new Error("counter copy failed"));

    const run = await runSync("HOUSEKEEPING");
    expect(run.ok).toBe(false);
    expect(run.message).toMatch(/counter copy failed/);
    expect(await db.emailSend.findFirstOrThrow()).toMatchObject({ status: "SENT" });
  });
});

describe("runSyncNow", () => {
  it("runs the sync, logs it, and expires tags at once (admin context)", async () => {
    stubFetch(() => new Response(fixture("letterboxd.xml")));
    await expect(runSyncNow("LETTERBOXD")).resolves.toEqual({ ok: true, message: "Done · 50 changed" });
    expect(await db.syncRun.findFirstOrThrow()).toMatchObject({ source: "LETTERBOXD", ok: true, itemsChanged: 50 });
    expect(cache.updateTag).toHaveBeenCalledWith("films");
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("reports a failed run with its message", async () => {
    await seedRotation();
    stubFetch(() => new Response("", { status: 503 }));
    await expect(runSyncNow("STATSFM")).resolves.toEqual({ ok: false, message: "stats.fm responded 503" });
    expect(await db.albumListen.count()).toBe(3);
  });

  it("Strava from this machine is refused by the guard, never the network", async () => {
    const fetch = stubFetch(() => new Response("", { status: 500 }));
    const result = await runSyncNow("STRAVA");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/only on Vercel/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unknown sources and needs an admin session", async () => {
    await expect(runSyncNow("HOUSEKEEPING" as never)).rejects.toThrow();
    admin.signedIn = false;
    await expect(runSyncNow("LETTERBOXD")).rejects.toThrow();
    expect(await db.syncRun.count()).toBe(0);
  });
});

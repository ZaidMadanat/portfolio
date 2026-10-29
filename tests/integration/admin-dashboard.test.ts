import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The admin dashboard's data and its Run-sync-now action (spec §7) against
// the test database, with the admin check stubbed.

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

const { getDashboard } = await import("@/lib/admin/dashboard");
const { runSyncNow } = await import("@/app/admin/actions");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
});

const NOW = new Date("2026-10-29T16:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let n = 0;
async function post(status: "DRAFT" | "PUBLISHED", extra: Record<string, unknown> = {}) {
  n++;
  return db.post.create({
    data: {
      slug: `p${n}`,
      title: `Post ${n}`,
      blocks: [],
      category: "NOTES",
      status,
      publishedAt: status === "PUBLISHED" ? NOW : null,
      ...extra,
    },
  });
}

const review = (kind: "FOOD" | "FILM" | "ALBUM" | "CONCERT") =>
  db.review.create({ data: { kind, title: kind, rating: 8, date: NOW } });

const subscriber = (status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED") => {
  n++;
  return db.subscriber.create({ data: { email: `s${n}@example.com`, status, confirmToken: `c${n}`, unsubscribeToken: `u${n}` } });
};

describe("getDashboard", () => {
  it("counts an empty site as zeros, with every source never run", async () => {
    const d = await getDashboard();
    expect(d.stats).toEqual({
      published: 0,
      drafts: 0,
      reviews: { total: 0, FOOD: 0, FILM: 0, ALBUM: 0, CONCERT: 0 },
      confirmedSubscribers: 0,
      views: { total: 0, countedAt: null },
    });
    expect(d.drafts).toEqual([]);
    expect(d.sync.map((s) => [s.source, s.lastRun])).toEqual([
      ["LETTERBOXD", null],
      ["STATSFM", null],
      ["STRAVA", null],
    ]);
  });

  it("counts posts, reviews by kind, confirmed subscribers and stored views", async () => {
    const a = await post("PUBLISHED");
    const b = await post("PUBLISHED");
    await post("DRAFT");
    await review("FOOD");
    await review("FOOD");
    await review("FILM");
    await review("CONCERT");
    await subscriber("CONFIRMED");
    await subscriber("CONFIRMED");
    await subscriber("PENDING");
    await subscriber("UNSUBSCRIBED");
    await db.postStat.create({ data: { postId: a.id, views: 120, likes: 3, syncedAt: daysAgo(1) } });
    await db.postStat.create({ data: { postId: b.id, views: 30, likes: 0, syncedAt: daysAgo(2) } });

    const { stats } = await getDashboard();
    expect(stats).toEqual({
      published: 2,
      drafts: 1,
      reviews: { total: 4, FOOD: 2, FILM: 1, ALBUM: 0, CONCERT: 1 },
      confirmedSubscribers: 2,
      views: { total: 150, countedAt: daysAgo(1) },
    });
  });

  it("lists drafts, most recently edited first, with their template", async () => {
    const t = await db.template.create({ data: { name: "Notes / cheat sheet", builtIn: true, blocks: [] } });
    const older = await post("DRAFT", { title: "", templateId: t.id, readingMinutes: 4 });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await post("DRAFT", { title: "Hypothesis testing" });
    await post("PUBLISHED");

    const { drafts } = await getDashboard();
    expect(drafts.map((d) => [d.id, d.title, d.templateName, d.readingMinutes])).toEqual([
      [newer.id, "Hypothesis testing", null, 1],
      [older.id, "", "Notes / cheat sheet", 4],
    ]);
  });

  it("shows the latest run per source and ignores housekeeping", async () => {
    await db.syncRun.create({ data: { source: "LETTERBOXD", startedAt: daysAgo(2), finishedAt: daysAgo(2), ok: true, itemsChanged: 1 } });
    await db.syncRun.create({
      data: { source: "LETTERBOXD", startedAt: daysAgo(1), finishedAt: daysAgo(1), ok: true, itemsChanged: 3, message: "3 new logs" },
    });
    await db.syncRun.create({ data: { source: "STATSFM", startedAt: daysAgo(1), ok: false, message: "stats.fm returned 500" } });
    await db.syncRun.create({ data: { source: "HOUSEKEEPING", startedAt: daysAgo(1), ok: true } });

    const { sync } = await getDashboard();
    expect(sync).toEqual([
      { source: "LETTERBOXD", lastRun: { startedAt: daysAgo(1), finishedAt: daysAgo(1), ok: true, message: "3 new logs", itemsChanged: 3 } },
      { source: "STATSFM", lastRun: { startedAt: daysAgo(1), finishedAt: null, ok: false, message: "stats.fm returned 500", itemsChanged: 0 } },
      { source: "STRAVA", lastRun: null },
    ]);
  });
});

describe("runSyncNow", () => {
  it("isn't wired to the sync code yet (Task 32)", async () => {
    await expect(runSyncNow("LETTERBOXD")).resolves.toEqual({ ok: false, message: "Not wired yet" });
    expect(await db.syncRun.count()).toBe(0);
  });

  it("rejects unknown sources", async () => {
    await expect(runSyncNow("HOUSEKEEPING" as never)).rejects.toThrow();
  });

  it("needs an admin session", async () => {
    admin.signedIn = false;
    await expect(runSyncNow("STRAVA")).rejects.toThrow();
  });
});

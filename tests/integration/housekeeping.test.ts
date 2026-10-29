import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getDashboard } from "@/lib/admin/dashboard";
import { likePost, recordView } from "@/lib/counters";
import { memoryStore, type CounterStore } from "@/lib/redis";
import { copyCounters } from "@/lib/sync/housekeeping";
import { resetDb } from "./reset";

// Housekeeping's counter copy (spec §9.1): Redis views/likes → PostStat (the
// running total) and PostStatDaily (one row per post per day, for the
// dashboard's 30-day views).

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => () => new Date(iso);

let n = 0;
async function post(extra: Record<string, unknown> = {}) {
  n++;
  return db.post.create({
    data: {
      slug: `hk${n}`,
      title: `Post ${n}`,
      blocks: [],
      category: "NOTES",
      status: "PUBLISHED",
      publishedAt: new Date("2026-10-01T00:00:00Z"),
      ...extra,
    },
  });
}

async function views(store: CounterStore, postId: string, count: number) {
  for (let i = 0; i < count; i++) await recordView(store, postId);
}

beforeEach(resetDb);

describe("copyCounters", () => {
  it("copies views and likes into PostStat and today's PostStatDaily row", async () => {
    const a = await post();
    const b = await post();
    const store = memoryStore();
    await views(store, a.id, 5);
    await views(store, b.id, 2);
    await likePost(store, a.id, "vid-1", "s");
    await likePost(store, a.id, "vid-2", "s");

    const result = await copyCounters({ store, db, now: at("2026-10-29T13:30:00Z") });
    expect(result).toEqual({ itemsChanged: 2 });

    const stats = await db.postStat.findMany({ orderBy: { views: "desc" } });
    expect(stats.map((s) => [s.postId, s.views, s.likes])).toEqual([
      [a.id, 5, 2],
      [b.id, 2, 0],
    ]);
    expect(stats[0].syncedAt).toEqual(new Date("2026-10-29T13:30:00Z"));

    const daily = await db.postStatDaily.findMany({ orderBy: { views: "desc" } });
    expect(daily.map((d) => [d.postId, d.day, d.views, d.likes])).toEqual([
      [a.id, day("2026-10-29"), 5, 2],
      [b.id, day("2026-10-29"), 2, 0],
    ]);
  });

  it("a second run the same day updates that day's row; the next day adds a row", async () => {
    const a = await post();
    const store = memoryStore();
    await views(store, a.id, 3);
    await copyCounters({ store, db, now: at("2026-10-29T13:30:00Z") });

    await views(store, a.id, 1);
    expect(await copyCounters({ store, db, now: at("2026-10-29T18:00:00Z") })).toEqual({ itemsChanged: 1 });
    // Nothing changed since: 0 changed, but the day still gets its snapshot.
    expect(await copyCounters({ store, db, now: at("2026-10-30T13:30:00Z") })).toEqual({ itemsChanged: 0 });

    const daily = await db.postStatDaily.findMany({ orderBy: { day: "asc" } });
    expect(daily.map((d) => [d.day, d.views])).toEqual([
      [day("2026-10-29"), 4],
      [day("2026-10-30"), 4],
    ]);
    expect((await db.postStat.findUniqueOrThrow({ where: { postId: a.id } })).views).toBe(4);
  });

  it("skips drafts that were never published (they have no public page)", async () => {
    await post({ status: "DRAFT", publishedAt: null });
    const unpublished = await post({ status: "DRAFT" }); // was public once; keeps its numbers
    const store = memoryStore();
    await views(store, unpublished.id, 7);
    await copyCounters({ store, db, now: at("2026-10-29T13:30:00Z") });
    expect((await db.postStatDaily.findMany()).map((d) => [d.postId, d.views])).toEqual([[unpublished.id, 7]]);
  });
});

describe("dashboard views over 30 days", () => {
  async function snapshot(postId: string, iso: string, views: number) {
    await db.postStatDaily.create({ data: { postId, day: day(iso), views, likes: 0 } });
  }

  it("is the latest total minus the total 30 days before it", async () => {
    const a = await post();
    const b = await post();
    await snapshot(a.id, "2026-09-20", 10);
    await snapshot(a.id, "2026-09-29", 40);
    await snapshot(a.id, "2026-10-29", 100);
    // b was published inside the window: all its views count.
    await snapshot(b.id, "2026-10-15", 5);
    await snapshot(b.id, "2026-10-29", 25);

    const { stats } = await getDashboard();
    expect(stats.views).toEqual({ recent: 85, since: day("2026-09-29"), full: true, countedAt: day("2026-10-29") });
  });

  it("uses the oldest snapshot when there's less than 30 days of history", async () => {
    const a = await post();
    await snapshot(a.id, "2026-10-20", 60);
    await snapshot(a.id, "2026-10-29", 100);
    const { stats } = await getDashboard();
    expect(stats.views).toEqual({ recent: 40, since: day("2026-10-20"), full: false, countedAt: day("2026-10-29") });
  });

  it("copyCounters feeds the tile", async () => {
    const a = await post();
    const store = memoryStore();
    await views(store, a.id, 3);
    await copyCounters({ store, db, now: at("2026-10-01T13:30:00Z") });
    await views(store, a.id, 9);
    await copyCounters({ store, db, now: at("2026-10-31T13:30:00Z") });
    const { stats } = await getDashboard();
    expect(stats.views).toEqual({ recent: 9, since: day("2026-10-01"), full: true, countedAt: day("2026-10-31") });
  });
});

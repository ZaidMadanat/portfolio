import type { PrismaClient } from "@/generated/prisma/client";
import { countLikes, getViews } from "@/lib/counters";
import { db as prisma } from "@/lib/db";
import { getStore, type CounterStore } from "@/lib/redis";
import { utcDay } from "@/lib/admin/views-window";

// Housekeeping's counter copy (spec §9.1): the Redis views and likes go into
// PostStat (one running total per post) and PostStatDaily (that total as it
// stood on the run's UTC date, so the dashboard can show 30-day views).
// Public pages never read either table.

export type CopyCountersDeps = {
  store?: CounterStore;
  db?: PrismaClient;
  now?: () => Date;
};

/**
 * Copies the counters of every post that was ever published (a never-published
 * draft has no public page, so no counters). Re-running on the same day updates
 * that day's snapshot. `itemsChanged` counts posts whose numbers moved.
 */
export async function copyCounters(deps: CopyCountersDeps = {}): Promise<{ itemsChanged: number }> {
  const { store = getStore(), db = prisma, now = () => new Date() } = deps;
  const at = now();
  const day = utcDay(at);

  const posts = await db.post.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { id: "asc" },
    select: { id: true, stat: { select: { views: true, likes: true } } },
  });

  let itemsChanged = 0;
  for (const post of posts) {
    const [views, likes] = await Promise.all([getViews(store, post.id), countLikes(store, post.id)]);
    if (!post.stat || post.stat.views !== views || post.stat.likes !== likes) itemsChanged++;
    await db.$transaction([
      db.postStat.upsert({
        where: { postId: post.id },
        create: { postId: post.id, views, likes, syncedAt: at },
        update: { views, likes, syncedAt: at },
      }),
      db.postStatDaily.upsert({
        where: { postId_day: { postId: post.id, day } },
        create: { postId: post.id, day, views, likes },
        update: { views, likes },
      }),
    ]);
  }
  return { itemsChanged };
}

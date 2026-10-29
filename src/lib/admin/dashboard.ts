import type { ReviewKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// The admin dashboard's reads (spec §7). Callers check the admin session.

/** The sources the dashboard shows, in order. Housekeeping isn't a source people run. */
export const SYNC_SOURCES = ["LETTERBOXD", "STATSFM", "STRAVA"] as const;
export type SyncSourceName = (typeof SYNC_SOURCES)[number];

export const SYNC_SOURCE_LABEL: Record<SyncSourceName, string> = {
  LETTERBOXD: "Letterboxd",
  STATSFM: "stats.fm",
  STRAVA: "Strava",
};

const DRAFT_LIMIT = 5;

export type DashboardDraft = {
  id: string;
  title: string;
  updatedAt: Date;
  readingMinutes: number;
  templateName: string | null;
};

export type SyncRunSummary = {
  startedAt: Date;
  finishedAt: Date | null;
  ok: boolean;
  message: string;
  itemsChanged: number;
};

export type Dashboard = {
  stats: {
    published: number;
    drafts: number;
    reviews: Record<ReviewKind, number> & { total: number };
    confirmedSubscribers: number;
    /**
     * Sum of the stored view counters (PostStat, copied from Redis daily) and
     * when they were last copied. PostStat holds one running total per post,
     * so this is all-time, not a 30-day window.
     */
    views: { total: number; countedAt: Date | null };
  };
  drafts: DashboardDraft[];
  sync: { source: SyncSourceName; lastRun: SyncRunSummary | null }[];
};

const RUN_FIELDS = { startedAt: true, finishedAt: true, ok: true, message: true, itemsChanged: true } as const;

export async function getDashboard(): Promise<Dashboard> {
  const [posts, reviews, confirmedSubscribers, views, drafts, runs] = await Promise.all([
    db.post.groupBy({ by: ["status"], _count: { _all: true } }),
    db.review.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.postStat.aggregate({ _sum: { views: true }, _max: { syncedAt: true } }),
    db.post.findMany({
      where: { status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: DRAFT_LIMIT,
      select: { id: true, title: true, updatedAt: true, readingMinutes: true, template: { select: { name: true } } },
    }),
    Promise.all(
      SYNC_SOURCES.map((source) =>
        db.syncRun.findFirst({ where: { source }, orderBy: { startedAt: "desc" }, select: RUN_FIELDS }),
      ),
    ),
  ]);

  const postCount = (s: "DRAFT" | "PUBLISHED") => posts.find((p) => p.status === s)?._count._all ?? 0;
  const reviewCount = (k: ReviewKind) => reviews.find((r) => r.kind === k)?._count._all ?? 0;
  const byKind = { FOOD: reviewCount("FOOD"), FILM: reviewCount("FILM"), ALBUM: reviewCount("ALBUM"), CONCERT: reviewCount("CONCERT") };

  return {
    stats: {
      published: postCount("PUBLISHED"),
      drafts: postCount("DRAFT"),
      reviews: { total: byKind.FOOD + byKind.FILM + byKind.ALBUM + byKind.CONCERT, ...byKind },
      confirmedSubscribers,
      views: { total: views._sum.views ?? 0, countedAt: views._max.syncedAt ?? null },
    },
    drafts: drafts.map(({ template, ...d }) => ({ ...d, templateName: template?.name ?? null })),
    sync: SYNC_SOURCES.map((source, i) => ({ source, lastRun: runs[i] ?? null })),
  };
}

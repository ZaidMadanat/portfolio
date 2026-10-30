import type { ReviewKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { viewsWindow } from "@/lib/admin/views-window";

// The admin dashboard's reads (spec §7). Callers check the admin session.

/**
 * The jobs the dashboard shows, in order, each with its last run and a run-now
 * button. Housekeeping (counter copy, daily snapshot, email queue) comes last.
 */
export const SYNC_SOURCES = ["LETTERBOXD", "STATSFM", "STRAVA", "HOUSEKEEPING"] as const;
export type SyncSourceName = (typeof SYNC_SOURCES)[number];

export const SYNC_SOURCE_LABEL: Record<SyncSourceName, string> = {
  LETTERBOXD: "Letterboxd",
  STATSFM: "stats.fm",
  STRAVA: "Strava",
  HOUSEKEEPING: "Housekeeping",
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
     * Views over the last 30 days, from the daily snapshots (PostStatDaily):
     * the latest total minus the one 30 days before it. With less history,
     * `full` is false and `since` is the oldest snapshot's day ("since <date>").
     * `countedAt` is the latest snapshot's day; null before the first run.
     */
    views: { recent: number; since: Date | null; full: boolean; countedAt: Date | null };
  };
  drafts: DashboardDraft[];
  sync: { source: SyncSourceName; lastRun: SyncRunSummary | null }[];
};

const RUN_FIELDS = { startedAt: true, finishedAt: true, ok: true, message: true, itemsChanged: true } as const;

function viewsTile(days: { day: Date; views: number }[]): Dashboard["stats"]["views"] {
  const w = viewsWindow(days);
  return { recent: w.views, since: w.since, full: w.full, countedAt: w.asOf };
}

export async function getDashboard(): Promise<Dashboard> {
  const [posts, reviews, confirmedSubscribers, views, drafts, runs] = await Promise.all([
    db.post.groupBy({ by: ["status"], _count: { _all: true } }),
    db.review.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.postStatDaily.groupBy({ by: ["day"], _sum: { views: true }, orderBy: { day: "asc" } }),
    db.post.findMany({
      where: { status: "DRAFT" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: DRAFT_LIMIT,
      select: { id: true, title: true, updatedAt: true, readingMinutes: true, template: { select: { name: true } } },
    }),
    Promise.all(
      SYNC_SOURCES.map((source) =>
        db.syncRun.findFirst({ where: { source }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], select: RUN_FIELDS }),
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
      views: viewsTile(views.map((d) => ({ day: d.day, views: d._sum.views ?? 0 }))),
    },
    drafts: drafts.map(({ template, ...d }) => ({ ...d, templateName: template?.name ?? null })),
    sync: SYNC_SOURCES.map((source, i) => ({ source, lastRun: runs[i] ?? null })),
  };
}

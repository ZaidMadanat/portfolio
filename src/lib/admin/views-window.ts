// The dashboard's views tile (decision "30-day views"): the latest daily total
// minus the total from 30 days before it. Pure, so it's unit-tested apart from
// the database. Days are UTC calendar dates (PostStatDaily.day).

const DAY_MS = 24 * 60 * 60 * 1000;
export const VIEWS_WINDOW_DAYS = 30;

export type DayTotal = { day: Date; views: number };

export type ViewsWindow = {
  /** Views between the baseline snapshot and the latest one. */
  views: number;
  /** The baseline snapshot's day; null before anything was counted. */
  since: Date | null;
  /** True when the baseline is at least 30 days before the latest snapshot; else it's the oldest one. */
  full: boolean;
  /** The latest snapshot's day. */
  asOf: Date | null;
};

/** The UTC calendar date of `d`, at midnight UTC (how PostStatDaily.day is stored). */
export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * `days` are per-day totals in any order. The baseline is the newest snapshot
 * at least `windowDays` before the latest (a skipped cron doesn't break the
 * window); with less history than that, it's the oldest snapshot. Never negative.
 */
export function viewsWindow(days: DayTotal[], windowDays = VIEWS_WINDOW_DAYS): ViewsWindow {
  if (days.length === 0) return { views: 0, since: null, full: false, asOf: null };
  const sorted = [...days].sort((a, b) => a.day.getTime() - b.day.getTime());
  const latest = sorted[sorted.length - 1];
  const cutoff = latest.day.getTime() - windowDays * DAY_MS;
  const old = sorted.filter((d) => d.day.getTime() <= cutoff);
  const baseline = old.length > 0 ? old[old.length - 1] : sorted[0];
  return {
    views: Math.max(0, latest.views - baseline.views),
    since: baseline.day,
    full: old.length > 0,
    asOf: latest.day,
  };
}

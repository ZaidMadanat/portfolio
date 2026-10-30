import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";

export type StravaActivityView = {
  id: string;
  name: string;
  sportType: string;
  distanceM: number;
  movingS: number;
  startAt: Date;
  url: string;
};

const WINDOW_MS = 14 * 86_400_000;

// unstable_cache stores JSON, so dates cross it as ISO strings.
const loadRecent = cached(
  async () => {
    const rows = await db.stravaActivity.findMany({
      where: { startAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
    });
    return rows.map((a) => ({ ...a, startAt: a.startAt.toISOString() }));
  },
  [TAGS.home],
  "strava:recent",
);

/** Public activities from the last 14 days, newest first. Rebuilt by the `home` tag (Strava sync). */
export async function getRecentStravaActivities(): Promise<StravaActivityView[]> {
  return (await loadRecent()).map((a) => ({ ...a, startAt: new Date(a.startAt) }));
}

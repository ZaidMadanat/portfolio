// "Off the keyboard" totals (spec §6.1): the last 14 days of public Strava activities.

export type StravaActivityLike = {
  sportType: string;
  distanceM: number;
  movingS: number;
  startAt: Date;
};

export type StravaSummary<T extends StravaActivityLike = StravaActivityLike> = {
  miles: number;
  walks: number;
  runs: number;
  hikes: number;
  lifts: number;
  movingHours: number;
  /** The activities inside the window, newest first. */
  items: T[];
};

const WINDOW_MS = 14 * 86_400_000;
const METRES_PER_MILE = 1609.344;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Totals for `now − 14 days` up to `now`, both ends included. */
export function summarizeStrava<T extends StravaActivityLike>(acts: T[], now: Date): StravaSummary<T> {
  const end = now.getTime();
  const start = end - WINDOW_MS;
  const items = acts
    .filter((a) => a.startAt.getTime() >= start && a.startAt.getTime() <= end)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

  const count = (...types: string[]) => items.filter((a) => types.includes(a.sportType)).length;
  const metres = items.reduce((sum, a) => sum + a.distanceM, 0);
  const seconds = items.reduce((sum, a) => sum + a.movingS, 0);

  return {
    miles: round1(metres / METRES_PER_MILE),
    walks: count("Walk"),
    runs: count("Run", "TrailRun"),
    hikes: count("Hike"),
    lifts: count("WeightTraining"),
    movingHours: round1(seconds / 3600),
    items,
  };
}

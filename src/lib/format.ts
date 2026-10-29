// Display formatting shared by public pages.

/** Zaid is in Berkeley; timestamps (post dates, Strava starts) read in Pacific time. */
export const SITE_TIME_ZONE = "America/Los_Angeles";

/**
 * "Apr 26". Calendar dates stored as UTC midnight (FilmLog.watchedAt,
 * Review.date) use the default UTC zone, so they never shift a day.
 */
export function formatMonthDay(date: Date | string, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(
    new Date(date),
  );
}

/** "50 min", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "2.68 mi". */
export function formatMiles(metres: number): string {
  return `${(metres / 1609.344).toFixed(2)} mi`;
}

/** Strava `sport_type` for people: "WeightTraining" → "Weight training". */
export function sportLabel(sportType: string): string {
  const words = sportType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "$$" for price 2. */
export function priceLabel(price: number): string {
  return "$".repeat(Math.max(1, Math.min(4, price)));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

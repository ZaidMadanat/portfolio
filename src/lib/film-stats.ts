import { SITE_TIME_ZONE } from "@/lib/format";
import type { FilmCard } from "@/lib/queries/films";

// Film page helpers (spec §6.6). Browser-safe: the chips filter in the browser.

/** "2026-04" for the calendar month of `now` in Berkeley. */
function monthKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE, year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

/** "April" for the calendar month of `now` in Berkeley. */
export function monthName(now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: SITE_TIME_ZONE, month: "long" }).format(now);
}

/**
 * Logs in the calendar month of `now` (America/Los_Angeles), and the average of
 * their displayed ratings to one decimal. Unrated logs count but don't average.
 */
export function monthStats(cards: FilmCard[], now: Date): { count: number; average: number | null } {
  const key = monthKey(now);
  const month = cards.filter((c) => c.watchedAt.startsWith(key));
  const rated = month.flatMap((c) => (c.rating == null ? [] : [c.rating]));
  const average = rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null;
  return { count: month.length, average };
}

export type FilmFilter = "all" | "top" | "review";

export const FILM_FILTERS: { id: FilmFilter; label: string }[] = [
  { id: "all", label: "All logs" },
  { id: "top", label: "9 and up" },
  { id: "review", label: "Has a review" },
];

/** "9 and up" uses the displayed rating, the same one the stamp shows. */
export function filterFilms(cards: FilmCard[], filter: FilmFilter): FilmCard[] {
  if (filter === "top") return cards.filter((c) => c.rating != null && c.rating >= 9);
  if (filter === "review") return cards.filter((c) => c.hasReview);
  return cards;
}

/** "★★★★½"; null when unrated (unrated shows no rating at all). */
export function starsLabel(stars: number | null): string | null {
  if (stars == null || stars <= 0) return null;
  const whole = Math.floor(stars);
  return "★".repeat(whole) + (stars - whole >= 0.5 ? "½" : "");
}

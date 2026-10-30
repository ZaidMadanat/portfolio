import { BASE_CUISINES } from "@/lib/cuisines";
import { inBand, type RatingBand } from "@/lib/rating";
import { REGIONS, type Region } from "@/lib/regions";
import type { Place } from "@/lib/queries/food";

// /reviews/food filters (spec §6.5). Pure and browser-safe: the client filters
// the static place list, and the URL query (?cuisine=&price=&region=&rating=)
// mirrors the choice so a filtered map can be shared.

export type Price = 1 | 2 | 3 | 4;

export type FoodQuery = {
  /** Empty means every cuisine. */
  cuisines: string[];
  price?: Price;
  region?: Region;
  band?: RatingBand;
};

export const PRICES: readonly Price[] = [1, 2, 3, 4];

/** The rating chips after "Any", in spec order. Bands overlap (8 is in "8+" and "7-8"). */
export const RATING_BANDS: readonly RatingBand[] = ["9-10", "8+", "7-8", "<=6"];

export const RATING_BAND_LABELS: Record<RatingBand, string> = {
  "9-10": "9–10",
  "8+": "8 and up",
  "7-8": "7–8",
  "<=6": "6 and under",
};

export type PinTone = "accent" | "second" | "surface";

/** The pin colours a band's places can have, for the dots on its chip. */
export function bandTones(band: RatingBand): PinTone[] {
  switch (band) {
    case "9-10":
      return ["accent"];
    case "8+":
      return ["accent", "second"];
    case "7-8":
      return ["second"];
    case "<=6":
      return ["surface"];
  }
}

/** Every filter must match; an empty cuisine list matches all. Keeps the input order. */
export function filterPlaces(places: Place[], q: FoodQuery): Place[] {
  const cuisines = q.cuisines.length ? new Set(q.cuisines) : null;
  return places.filter(
    (p) =>
      (!cuisines || cuisines.has(p.cuisine)) &&
      (!q.price || p.price === q.price) &&
      (!q.region || p.region === q.region) &&
      (!q.band || inBand(p.rating, q.band)),
  );
}

/** Newest visit first; the same day falls back to the id, so the order never wobbles. */
export function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.date < b.date ? 1 : -1));
}

/** The base cuisines in spec order (zeros included), then custom ones used in reviews, A–Z. */
export function cuisineOptions(places: Place[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.cuisine, (counts.get(p.cuisine) ?? 0) + 1);
  const base = new Set(BASE_CUISINES);
  const custom = [...counts.keys()].filter((c) => !base.has(c)).sort((a, b) => a.localeCompare(b));
  return [...BASE_CUISINES, ...custom].map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

const isPrice = (n: number): n is Price => (PRICES as readonly number[]).includes(n);
const isRegion = (v: string): v is Region => (REGIONS as readonly string[]).includes(v);
const isBand = (v: string): v is RatingBand => (RATING_BANDS as readonly string[]).includes(v);

/** Reads the URL query. Invalid values and repeated cuisines are dropped. */
export function parseFoodQuery(sp: URLSearchParams): FoodQuery {
  const cuisines = [...new Set(sp.getAll("cuisine").map((c) => c.trim()).filter(Boolean))];
  const out: FoodQuery = { cuisines };
  const price = Number(sp.get("price"));
  if (isPrice(price)) out.price = price;
  const region = sp.get("region");
  if (region && isRegion(region)) out.region = region;
  const band = sp.get("rating");
  if (band && isBand(band)) out.band = band;
  return out;
}

/** "?cuisine=Mexican&cuisine=Pizza&price=2&region=EAST_BAY&rating=8%2B" (fixed order), or "". */
export function foodQueryString(q: FoodQuery): string {
  const sp = new URLSearchParams();
  for (const c of q.cuisines) sp.append("cuisine", c);
  if (q.price) sp.set("price", String(q.price));
  if (q.region) sp.set("region", q.region);
  if (q.band) sp.set("rating", q.band);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const hasFoodFilters = (q: FoodQuery) => q.cuisines.length > 0 || Boolean(q.price || q.region || q.band);

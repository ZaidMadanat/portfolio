import { describe, expect, it } from "vitest";
import { BASE_CUISINES } from "@/lib/cuisines";
import {
  bandTones,
  cuisineOptions,
  filterPlaces,
  foodQueryString,
  hasFoodFilters,
  parseFoodQuery,
  RATING_BAND_LABELS,
  RATING_BANDS,
  sortPlaces,
  type FoodQuery,
} from "@/lib/food-filters";
import type { Place } from "@/lib/queries/food";

// The canvas Food board's 8 sample places (the same ones the dev seed adds).
const place = (
  id: string,
  name: string,
  cuisine: string,
  price: Place["price"],
  neighbourhood: string,
  city: string,
  region: Place["region"],
  rating: number,
  date: string,
): Place => ({
  id,
  name,
  cuisine,
  price,
  neighbourhood,
  city,
  region,
  rating,
  lat: 37.8,
  lng: -122.3,
  date,
  dishes: [{ name: "Something good", mustOrder: true }],
  photos: [],
  postSlug: null,
});

const PLACES: Place[] = [
  place("la-taqueria", "La Taqueria", "Mexican", 1, "Mission", "San Francisco", "SAN_FRANCISCO", 9, "2026-03-14"),
  place("tartine", "Tartine Bakery", "Bakery", 2, "Mission", "San Francisco", "SAN_FRANCISCO", 8, "2026-02-08"),
  place("marufuku", "Marufuku Ramen", "Japanese", 2, "Japantown", "San Francisco", "SAN_FRANCISCO", 8, "2026-01-23"),
  place("state-bird", "State Bird Provisions", "Californian", 3, "Fillmore", "San Francisco", "SAN_FRANCISCO", 9, "2025-12-12"),
  place("burma", "Burma Superstar", "Burmese", 2, "Inner Richmond", "San Francisco", "SAN_FRANCISCO", 8, "2025-11-29"),
  place("cheese-board", "Cheese Board Pizza", "Pizza", 1, "North Berkeley", "Berkeley", "EAST_BAY", 9, "2026-04-04"),
  place("comal", "Comal", "Mexican", 2, "Downtown Berkeley", "Berkeley", "EAST_BAY", 6, "2026-02-21"),
  place("zacharys", "Zachary's Chicago Pizza", "Pizza", 2, "Rockridge", "Oakland", "EAST_BAY", 7, "2025-10-18"),
];

const ids = (places: Place[]) => places.map((p) => p.id);
const q = (patch: Partial<FoodQuery> = {}): FoodQuery => ({ cuisines: [], ...patch });

describe("filterPlaces", () => {
  it("an empty query (no cuisines) keeps every place, in order", () => {
    expect(ids(filterPlaces(PLACES, q()))).toEqual(ids(PLACES));
  });

  it("cuisines are a multi-select: Mexican + Pizza gives 4", () => {
    expect(filterPlaces(PLACES, q({ cuisines: ["Mexican", "Pizza"] }))).toHaveLength(4);
  });

  it("region East Bay gives 3", () => {
    expect(ids(filterPlaces(PLACES, q({ region: "EAST_BAY" })))).toEqual(["cheese-board", "comal", "zacharys"]);
  });

  it("rating band 8+ gives 6", () => {
    expect(filterPlaces(PLACES, q({ band: "8+" }))).toHaveLength(6);
  });

  it("region North Bay matches nothing (Review Focus 3)", () => {
    expect(filterPlaces(PLACES, q({ region: "NORTH_BAY" }))).toEqual([]);
  });

  it("filters combine", () => {
    expect(ids(filterPlaces(PLACES, q({ cuisines: ["Pizza", "Mexican"], price: 2, region: "EAST_BAY" })))).toEqual([
      "comal",
      "zacharys",
    ]);
    expect(ids(filterPlaces(PLACES, q({ cuisines: ["Mexican"], band: "<=6" })))).toEqual(["comal"]);
    expect(ids(filterPlaces(PLACES, q({ band: "7-8", region: "EAST_BAY" })))).toEqual(["zacharys"]);
    expect(ids(filterPlaces(PLACES, q({ band: "9-10", price: 1 })))).toEqual(["la-taqueria", "cheese-board"]);
  });
});

describe("cuisineOptions", () => {
  it("lists every base cuisine in order, zeros included, then custom cuisines A–Z, each with a count", () => {
    const custom = [
      ...PLACES,
      { ...PLACES[0], id: "x1", cuisine: "Peruvian" },
      { ...PLACES[0], id: "x2", cuisine: "Filipino" },
      { ...PLACES[0], id: "x3", cuisine: "Peruvian" },
    ];
    const options = cuisineOptions(custom);
    expect(options.map((o) => o.name)).toEqual([...BASE_CUISINES, "Filipino", "Peruvian"]);
    expect(options).toContainEqual({ name: "Burmese", count: 1 });
    expect(options).toContainEqual({ name: "Mexican", count: 2 });
    expect(options).toContainEqual({ name: "Pizza", count: 2 });
    expect(options).toContainEqual({ name: "Thai", count: 0 });
    expect(options).toContainEqual({ name: "Peruvian", count: 2 });
  });

  it("with the canvas places, has Burmese once and every base cuisine", () => {
    const options = cuisineOptions(PLACES);
    expect(options).toContainEqual({ name: "Burmese", count: 1 });
    for (const name of BASE_CUISINES) expect(options.some((o) => o.name === name)).toBe(true);
    expect(options).toHaveLength(BASE_CUISINES.length);
  });
});

describe("rating bands", () => {
  it("are Any's four options, in spec order, with labels", () => {
    expect(RATING_BANDS).toEqual(["9-10", "8+", "7-8", "<=6"]);
    expect(RATING_BANDS.map((b) => RATING_BAND_LABELS[b])).toEqual(["9–10", "8 and up", "7–8", "6 and under"]);
  });

  it("name the pin colours each band covers", () => {
    expect(bandTones("9-10")).toEqual(["accent"]);
    expect(bandTones("8+")).toEqual(["accent", "second"]);
    expect(bandTones("7-8")).toEqual(["second"]);
    expect(bandTones("<=6")).toEqual(["surface"]);
  });
});

describe("sortPlaces", () => {
  it("is newest first, ties broken by id, and doesn't mutate", () => {
    const tied = [
      { ...PLACES[7], id: "b", date: "2026-05-01" },
      { ...PLACES[7], id: "a", date: "2026-05-01" },
      PLACES[6],
      PLACES[5],
    ];
    const before = ids(tied);
    expect(ids(sortPlaces(tied))).toEqual(["a", "b", "cheese-board", "comal"]);
    expect(ids(tied)).toEqual(before);
  });
});

describe("the URL query", () => {
  it("round-trips every filter in a fixed order", () => {
    const query = q({ cuisines: ["Mexican", "Coffee & Dessert"], price: 2, region: "EAST_BAY", band: "8+" });
    const s = foodQueryString(query);
    expect(s).toBe("?cuisine=Mexican&cuisine=Coffee+%26+Dessert&price=2&region=EAST_BAY&rating=8%2B");
    expect(parseFoodQuery(new URLSearchParams(s))).toEqual(query);
  });

  it("drops invalid values and duplicate cuisines", () => {
    const sp = new URLSearchParams("cuisine=Thai&cuisine=Thai&cuisine=&price=5&region=MARS&rating=11");
    expect(parseFoodQuery(sp)).toEqual({ cuisines: ["Thai"] });
    expect(foodQueryString(q())).toBe("");
  });

  it("hasFoodFilters is true once anything is set", () => {
    expect(hasFoodFilters(q())).toBe(false);
    expect(hasFoodFilters(q({ cuisines: ["Thai"] }))).toBe(true);
    expect(hasFoodFilters(q({ band: "<=6" }))).toBe(true);
  });
});

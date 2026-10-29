import { describe, expect, it } from "vitest";
import { displayedFilmRating, inBand, pinTone, starsToTen } from "@/lib/rating";

describe("starsToTen", () => {
  it("doubles Letterboxd stars to a whole /10", () => {
    expect(starsToTen(4.5)).toBe(9);
    expect(starsToTen(5)).toBe(10);
    expect(starsToTen(0.5)).toBe(1);
  });

  it("keeps unrated as null", () => {
    expect(starsToTen(null)).toBeNull();
    expect(starsToTen(undefined)).toBeNull();
  });
});

describe("displayedFilmRating", () => {
  it("prefers the linked review's rating", () => {
    expect(displayedFilmRating({ rating: 9 }, { rating: 7 })).toBe(7); // review wins
  });

  it("falls back to the log rating, or null", () => {
    expect(displayedFilmRating({ rating: 8 })).toBe(8);
    expect(displayedFilmRating({ rating: null }, null)).toBeNull();
  });
});

describe("inBand", () => {
  it("matches the food rating bands", () => {
    expect(inBand(8, "8+")).toBe(true);
    expect(inBand(8, "7-8")).toBe(true);
    expect(inBand(9, "7-8")).toBe(false);
    expect(inBand(6, "<=6")).toBe(true);
    expect(inBand(10, "9-10")).toBe(true);
    expect(inBand(8, "9-10")).toBe(false);
    expect(inBand(7, "<=6")).toBe(false);
  });
});

describe("pinTone", () => {
  it("maps rating bands to pin colours", () => {
    expect(pinTone(9)).toBe("accent");
    expect(pinTone(10)).toBe("accent");
    expect(pinTone(7)).toBe("second");
    expect(pinTone(8)).toBe("second");
    expect(pinTone(6)).toBe("surface");
  });
});

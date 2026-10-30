// Ratings are whole numbers 1–10 everywhere. Unrated is null and shows nothing.

/** Letterboxd stars (0.5–5, half steps) to a whole /10. ★★★★½ → 9. */
export function starsToTen(stars: number | null | undefined): number | null {
  if (stars == null || !Number.isFinite(stars) || stars <= 0) return null;
  return Math.min(10, Math.max(1, Math.round(stars * 2)));
}

/** A linked FILM review's rating wins over the log's own rating (spec §6.6). */
export function displayedFilmRating(
  log: { rating: number | null },
  review?: { rating: number } | null,
): number | null {
  return review?.rating ?? log.rating ?? null;
}

export type RatingBand = "9-10" | "8+" | "7-8" | "<=6";

/** Food rating filter bands (spec §6.5). Bands overlap: 8 is in both "8+" and "7-8". */
export function inBand(rating: number, band: RatingBand): boolean {
  switch (band) {
    case "9-10":
      return rating >= 9;
    case "8+":
      return rating >= 8;
    case "7-8":
      return rating >= 7 && rating <= 8;
    case "<=6":
      return rating <= 6;
  }
}

/** Map pin colour: 9–10 accent, 7–8 second, ≤6 surface. */
export function pinTone(rating: number): "accent" | "second" | "surface" {
  if (rating >= 9) return "accent";
  if (rating >= 7) return "second";
  return "surface";
}

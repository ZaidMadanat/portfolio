import type { ReviewKind } from "@/generated/prisma/enums";
import { priceLabel } from "@/lib/format";

// Review display helpers shared by public queries and the admin form's live
// preview. Browser-safe: no database or cache imports.

export const REVIEW_KIND_LABEL: Record<ReviewKind, string> = {
  FOOD: "Food",
  FILM: "Film",
  ALBUM: "Album",
  CONCERT: "Concert",
};

/** "Mexican · $ · Mission, San Francisco"; missing parts are skipped. */
export function foodMeta(r: {
  cuisine: string | null;
  price: number | null;
  neighbourhood: string | null;
  city: string | null;
}): string {
  return [r.cuisine, r.price ? priceLabel(r.price) : null, [r.neighbourhood, r.city].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

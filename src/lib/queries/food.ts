import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media/urls";
import type { Region } from "@/lib/regions";
import { reviewPhotoAlt, type ReviewPhoto } from "@/lib/reviews/photos";

// The /reviews/food data (spec §6.5): every FOOD review with a map position.

export type Place = {
  id: string;
  name: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4;
  neighbourhood: string;
  city: string;
  region: Region;
  rating: number;
  lat: number;
  lng: number;
  /** The visit day, "YYYY-MM-DD" (Review.date is UTC midnight). */
  date: string;
  dishes: { name: string; mustOrder: boolean }[];
  /** Photos in review order, sized for the place card, with the library's alt text. */
  photos: ReviewPhoto[];
  /** The linked post's slug, only when that post is published. */
  postSlug: string | null;
};

/** The card shows photos at up to ~480 CSS px wide, so 960 covers 2x screens. */
const PHOTO_WIDTH = 960;

/** Media.blobUrl is always a sized URL; fall back to it as-is rather than fail the page. */
function photoUrl(media: { blobUrl: string; width: number }): string {
  try {
    return mediaUrl(media, PHOTO_WIDTH);
  } catch {
    return media.blobUrl;
  }
}

const toPrice = (n: number | null): Place["price"] => (n && n >= 1 && n <= 4 ? (n as Place["price"]) : 1);

const loadPlaces = cached(
  async (): Promise<Place[]> => {
    const rows = await db.review.findMany({
      // saveReview requires all of these for FOOD; the filter guards older rows.
      where: { kind: "FOOD", lat: { not: null }, lng: { not: null }, region: { not: null } },
      orderBy: [{ date: "desc" }, { id: "asc" }],
      include: {
        dishes: { orderBy: [{ order: "asc" }, { id: "asc" }], select: { name: true, mustOrder: true } },
        photos: { orderBy: [{ order: "asc" }, { mediaId: "asc" }], select: { media: { select: { blobUrl: true, width: true, alt: true } } } },
        post: { select: { slug: true, status: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.title,
      cuisine: r.cuisine ?? "",
      price: toPrice(r.price),
      neighbourhood: r.neighbourhood ?? "",
      city: r.city ?? "",
      region: r.region as Region,
      rating: r.rating,
      lat: r.lat as number,
      lng: r.lng as number,
      date: r.date.toISOString().slice(0, 10),
      dishes: r.dishes,
      photos: r.photos.map((p, i) => ({ url: photoUrl(p.media), alt: reviewPhotoAlt(p.media.alt, r.title, i) })),
      postSlug: r.post?.status === "PUBLISHED" ? r.post.slug : null,
    }));
  },
  [TAGS.reviews],
  "food:places",
);

/** Newest visit first, then by id. Empty when there are no food reviews. */
export function getPlaces(): Promise<Place[]> {
  return loadPlaces();
}

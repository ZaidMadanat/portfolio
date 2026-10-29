import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache";

export type RevalidateEvent =
  | "post"
  | "review"
  | "favorites"
  | "mediaAlt"
  | "letterboxd"
  | "statsfm"
  | "strava";

export type RevalidateIds = { postId?: string; reviewId?: string; postIds?: string[] };

/** The tags each write revalidates (spec §7.3). Pure. Missing ids are skipped. */
export function tagsFor(event: RevalidateEvent, ids: RevalidateIds = {}): string[] {
  const post = ids.postId ? [TAGS.post(ids.postId)] : [];
  switch (event) {
    case "post":
      return [TAGS.posts, ...post, TAGS.rss, TAGS.home];
    case "review":
      return [TAGS.reviews, ...(ids.reviewId ? [TAGS.review(ids.reviewId)] : []), TAGS.home, ...post];
    case "favorites":
      return [TAGS.reviews];
    case "mediaAlt":
      return (ids.postIds ?? []).map(TAGS.post);
    case "letterboxd":
      return [TAGS.films, TAGS.home, TAGS.reviews];
    case "statsfm":
      return [TAGS.music, TAGS.home];
    case "strava":
      return [TAGS.home];
  }
}

/**
 * Revalidates every tag for a write. Call from server actions and cron routes
 * only. Uses the "max" profile (stale-while-revalidate): the next visit gets
 * the old page while the new one renders.
 */
export function revalidateFor(event: RevalidateEvent, ids?: RevalidateIds): void {
  for (const tag of tagsFor(event, ids)) revalidateTag(tag, "max");
}

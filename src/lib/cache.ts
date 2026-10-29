import { unstable_cache } from "next/cache";

// The only file that knows how Next caches tagged reads. cacheComponents is
// off (segment config like `revalidate = false` must keep working), so this
// uses unstable_cache rather than 'use cache' + cacheTag.

export const TAGS = {
  posts: "posts",
  post: (id: string) => `post:${id}`,
  rss: "rss",
  home: "home",
  reviews: "reviews",
  review: (id: string) => `review:${id}`,
  films: "films",
  music: "music",
} as const;

/**
 * A tagged, cached read. Entries never expire on a timer; they rebuild only
 * when a tag is revalidated (src/lib/revalidate.ts, spec §7.3).
 */
export function cached<T>(fn: () => Promise<T>, tags: string[], key: string): () => Promise<T> {
  return unstable_cache(fn, [key], { tags, revalidate: false });
}

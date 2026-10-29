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
 *
 * The key carries a per-build value. unstable_cache persists entries across
 * builds and deployments (.next/cache/fetch-cache, restored by Vercel, and
 * Vercel's data cache), so without it `next build` would bake the previous
 * build's data into static pages. CACHE_BUILD_KEY is set once per build in
 * next.config.ts and inlined into the bundle, so the build and the server it
 * produces use the same entries and tag revalidation keeps working.
 */
export function cached<T>(fn: () => Promise<T>, tags: string[], key: string): () => Promise<T> {
  const build = process.env.CACHE_BUILD_KEY || "dev";
  return unstable_cache(fn, [key, `build:${build}`], { tags, revalidate: false });
}

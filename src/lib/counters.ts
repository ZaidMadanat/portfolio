import type { CounterStore } from "./redis";

// Views and add-only likes (spec §9.2–9.3). There is deliberately no unlike:
// nothing here removes a member from a likes set.

const viewsKey = (postId: string) => `views:${postId}`;
const likesKey = (postId: string) => `likes:${postId}`;

const encoder = new TextEncoder();

/** Hex HMAC-SHA256 of `vid` keyed by `secret`. Web Crypto, so Edge-safe. */
export async function visitorHash(vid: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(vid));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function recordView(store: CounterStore, postId: string): Promise<number> {
  return store.incr(viewsKey(postId));
}

export function getViews(store: CounterStore, postId: string): Promise<number> {
  return store.get(viewsKey(postId));
}

/** How many visitors liked the post (no visitor check; for housekeeping). */
export function countLikes(store: CounterStore, postId: string): Promise<number> {
  return store.scard(likesKey(postId));
}

export async function likePost(
  store: CounterStore,
  postId: string,
  vid: string,
  secret: string,
): Promise<{ count: number; liked: true }> {
  await store.sadd(likesKey(postId), await visitorHash(vid, secret));
  return { count: await store.scard(likesKey(postId)), liked: true };
}

export async function getLikes(
  store: CounterStore,
  postId: string,
  vid: string | null | undefined,
  secret: string,
): Promise<{ count: number; liked: boolean }> {
  const [count, liked] = await Promise.all([
    store.scard(likesKey(postId)),
    vid ? store.sismember(likesKey(postId), await visitorHash(vid, secret)) : false,
  ]);
  return { count, liked };
}

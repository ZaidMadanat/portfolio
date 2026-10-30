"use server";

import { z } from "zod";
import { mediaUsage, NOT_USED } from "@/lib/admin/media-library";
import { renderPostBlocks } from "@/lib/blocks/post-html";
import { db } from "@/lib/db";
import { getMediaStore } from "@/lib/media/store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateFor } from "@/lib/revalidate";

// Photo library actions (spec §7). Each checks the admin session first.

const mediaId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const altText = z.string().trim().max(500);

/**
 * Sets a photo's alt text, re-renders Post.html for every post that shows it,
 * and expires those posts' pages straight away.
 */
export async function updateAlt(id: string, alt: string): Promise<{ alt: string; postsUpdated: number }> {
  await requireAdmin();
  const mid = mediaId.parse(id);
  const text = altText.parse(alt);

  await db.media.update({ where: { id: mid }, data: { alt: text } });
  const posts = await db.post.findMany({
    where: { media: { some: { mediaId: mid } } },
    select: { id: true, blocks: true },
  });
  for (const post of posts) {
    const { html } = await renderPostBlocks(post.blocks as unknown[]);
    await db.post.update({ where: { id: post.id }, data: { html } });
  }
  revalidateFor("mediaAlt", { postIds: posts.map((p) => p.id) }, { immediate: true });
  return { alt: text, postsUpdated: posts.length };
}

/**
 * Deletes an unused photo and every stored size. Throws `in-use` while a post
 * body, a post cover or a review uses it (the UI blocks this too).
 */
export async function deleteMedia(id: string): Promise<void> {
  await requireAdmin();
  const mid = mediaId.parse(id);

  const media = await db.media.findUnique({
    where: { id: mid },
    select: { _count: { select: { posts: true, reviews: true, coverOf: true } } },
  });
  if (!media) return;
  const { posts, reviews, coverOf } = media._count;
  if (posts + reviews + coverOf > 0) throw new Error("in-use");

  try {
    await db.media.delete({ where: { id: mid } });
  } catch (err) {
    // PostMedia/ReviewMedia restrict the delete: a save raced the check above.
    if ((err as { code?: string }).code === "P2003") throw new Error("in-use");
    throw err;
  }
  // The row goes first, so a storage failure leaves orphaned files, never a
  // broken image on a page.
  try {
    await getMediaStore().remove(mid);
  } catch (err) {
    console.error("Media delete: removing stored sizes failed:", err instanceof Error ? err.name : "unknown error");
  }
}

/** Where a photo is used, e.g. ["Review: La Taqueria"], or ["Not used yet"]. */
export async function usageOf(id: string): Promise<string[]> {
  await requireAdmin();
  const labels = await mediaUsage(mediaId.parse(id));
  if (labels === null) throw new Error("not-found");
  return labels.length > 0 ? labels : [NOT_USED];
}

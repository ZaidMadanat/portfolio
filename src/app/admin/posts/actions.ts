"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { Category } from "@/generated/prisma/enums";
import { excerptFrom, normalizeTags } from "@/lib/admin/post-fields";
import { slugTaken, UNTITLED_SLUG } from "@/lib/admin/posts";
import { renderPostBlocks } from "@/lib/blocks/post-html";
import { plainText } from "@/lib/blocks/render";
import { db } from "@/lib/db";
import { enqueuePostNotification } from "@/lib/email/queue";
import { readingMinutes } from "@/lib/reading-time";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateFor } from "@/lib/revalidate";
import { slugify, uniqueSlug } from "@/lib/slug";

// The post editor's actions (spec §7, §7.2, §7.3). Each checks the admin
// session first. Public pages are expired with updateTag, so a publish or an
// edit shows on the very next public load.

const id = z.string().min(1).max(64);

const saveInput = z.object({
  title: z.string().max(200),
  blocks: z.array(z.record(z.string(), z.unknown())).max(5000),
  category: z.enum(Category),
  tags: z.array(z.string().max(60)).max(30),
  reviewId: id.nullable(),
  /** Sent once the slug was edited by hand; otherwise a draft's slug follows its title. */
  slug: z.string().max(120).optional(),
  excerpt: z.string().max(300).optional(),
  coverMediaId: id.nullable().optional(),
  templateId: id.nullable().optional(),
});

export type SavePostInput = z.input<typeof saveInput>;
export type SavePostResult = { slug: string; readingMinutes: number; excerpt: string };

/** Expires a published post's pages, plus the reviews hub for any review it links (or linked). */
function revalidatePost(postId: string, reviewIds: (string | null)[]) {
  revalidateFor("post", { postId }, { immediate: true });
  for (const reviewId of new Set(reviewIds)) {
    if (reviewId) revalidateFor("review", { reviewId }, { immediate: true });
  }
}

/**
 * Saves the editor's state (autosave and before publishing): re-renders the
 * html, recomputes reading time, syncs PostMedia and tags, keeps the slug
 * unique and records a Redirect when a public post's slug changes.
 */
export async function savePost(postId: string, input: SavePostInput): Promise<SavePostResult> {
  await requireAdmin();
  const pid = id.parse(postId);
  const data = saveInput.parse(input);

  const post = await db.post.findUnique({
    where: { id: pid },
    select: { slug: true, status: true, publishedAt: true, reviewId: true },
  });
  if (!post) throw new Error("not-found");

  const title = data.title.trim();
  const blocks = data.blocks as unknown[];
  const text = plainText(blocks);

  let base: string;
  if (data.slug !== undefined) base = slugify(data.slug) || slugify(title) || UNTITLED_SLUG;
  else if (post.publishedAt === null) base = slugify(title) || UNTITLED_SLUG;
  else base = post.slug;
  const slug = base === post.slug ? post.slug : await uniqueSlug(base, (s) => slugTaken(s, pid));

  if (data.reviewId) {
    const review = await db.review.findUnique({ where: { id: data.reviewId }, select: { post: { select: { id: true } } } });
    if (!review) throw new Error("review-not-found");
    if (review.post && review.post.id !== pid) throw new Error("review-taken");
  }
  if (data.coverMediaId && !(await db.media.findUnique({ where: { id: data.coverMediaId }, select: { id: true } }))) {
    throw new Error("cover-not-found");
  }

  const { html, mediaIds } = await renderPostBlocks(blocks);
  const minutes = readingMinutes(text);
  const excerpt = data.excerpt?.trim() || excerptFrom(text);
  const tags = normalizeTags(data.tags);

  await db.$transaction(async (tx) => {
    if (slug !== post.slug) {
      // An old public URL keeps working (spec §7.3); a never-public draft's doesn't need to.
      if (post.publishedAt !== null) {
        await tx.redirect.upsert({
          where: { fromSlug: post.slug },
          create: { fromSlug: post.slug, postId: pid },
          update: { postId: pid },
        });
      }
      // Renamed back to an old slug: that redirect would point at itself.
      await tx.redirect.deleteMany({ where: { fromSlug: slug, postId: pid } });
    }
    const tagIds: string[] = [];
    for (const name of tags) {
      tagIds.push((await tx.tag.upsert({ where: { name }, create: { name }, update: {}, select: { id: true } })).id);
    }
    await tx.post.update({
      where: { id: pid },
      data: {
        title,
        slug,
        blocks: blocks as Prisma.InputJsonValue,
        html,
        excerpt,
        category: data.category,
        readingMinutes: minutes,
        reviewId: data.reviewId,
        ...(data.coverMediaId !== undefined ? { coverMediaId: data.coverMediaId } : {}),
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
        media: { deleteMany: {}, create: mediaIds.map((mediaId) => ({ mediaId })) },
      },
    });
  });

  if (post.status === "PUBLISHED") {
    revalidatePost(pid, post.reviewId === data.reviewId ? [] : [post.reviewId, data.reviewId]);
  }
  return { slug, readingMinutes: minutes, excerpt };
}

/**
 * Publishes a post. `publishedAt` is set the first time only, and the
 * new-post email is queued only while `notifiedAt` is unset (Task 15), so
 * re-publishing never mails anyone twice. The housekeeping cron sends it.
 */
export async function publishPost(postId: string): Promise<{ slug: string }> {
  await requireAdmin();
  const pid = id.parse(postId);
  const post = await db.post.findUnique({
    where: { id: pid },
    select: { title: true, slug: true, publishedAt: true, reviewId: true },
  });
  if (!post) throw new Error("not-found");
  if (!post.title.trim()) throw new Error("title-required");

  await db.post.update({
    where: { id: pid },
    data: { status: "PUBLISHED", publishedAt: post.publishedAt ?? new Date() },
  });
  await enqueuePostNotification(pid);
  revalidatePost(pid, [post.reviewId]);
  return { slug: post.slug };
}

/** Takes a post off the site. It keeps its first publish date. */
export async function unpublishPost(postId: string): Promise<void> {
  await requireAdmin();
  const pid = id.parse(postId);
  const post = await db.post.update({ where: { id: pid }, data: { status: "DRAFT" }, select: { reviewId: true } });
  revalidatePost(pid, [post.reviewId]);
}

const templateName = z.string().trim().min(1).max(80);

/** Saves a post's current blocks and category as a new user template. */
export async function saveAsTemplate(
  postId: string,
  name: string,
): Promise<{ id: string; name: string; category: Category | null; blocks: unknown[] }> {
  await requireAdmin();
  const pid = id.parse(postId);
  const cleanName = templateName.parse(name);
  const post = await db.post.findUnique({ where: { id: pid }, select: { blocks: true, category: true } });
  if (!post) throw new Error("not-found");
  const t = await db.template.create({
    data: { name: cleanName, builtIn: false, category: post.category, blocks: post.blocks as Prisma.InputJsonValue },
    select: { id: true, name: true, category: true, blocks: true },
  });
  return { ...t, blocks: t.blocks as unknown[] };
}

import type { Category, PostStatus, Prisma } from "@/generated/prisma/client";
import { renderPostBlocks } from "@/lib/blocks/post-html";
import { plainText } from "@/lib/blocks/render";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media/urls";
import { readingMinutes } from "@/lib/reading-time";
import { uniqueSlug } from "@/lib/slug";

// The post editor's server-side reads and draft creation (spec §7). Callers
// check the admin session.

export const UNTITLED_SLUG = "untitled";
const MAX_SLUG_ATTEMPTS = 10;

/**
 * True when `slug` belongs to another post, either as its slug or as one of
 * its old slugs (Redirect.fromSlug), so a post can't shadow another's redirect.
 */
export async function slugTaken(slug: string, exceptPostId?: string): Promise<boolean> {
  const other = exceptPostId ? { not: exceptPostId } : undefined;
  const [post, redirect] = await Promise.all([
    db.post.findFirst({ where: { slug, id: other }, select: { id: true } }),
    db.redirect.findFirst({ where: { fromSlug: slug, postId: other }, select: { id: true } }),
  ]);
  return post !== null || redirect !== null;
}

/**
 * A new draft, pre-filled with a template's blocks and category when
 * `templateId` names one (an unknown id gives a blank draft). The title is
 * empty and the slug a unique "untitled"; the first save derives it from the
 * title.
 */
export async function createDraft(templateId: string | null) {
  const template = templateId ? await db.template.findUnique({ where: { id: templateId } }) : null;
  const blocks = (template?.blocks ?? []) as unknown[];
  const { html } = await renderPostBlocks(blocks);
  for (let attempt = 1; ; attempt++) {
    const slug = await uniqueSlug(UNTITLED_SLUG, (s) => slugTaken(s));
    try {
      return await db.post.create({
        data: {
          title: "",
          slug,
          blocks: blocks as Prisma.InputJsonValue,
          html,
          category: template?.category ?? "NOTES",
          templateId: template?.id ?? null,
          readingMinutes: readingMinutes(plainText(blocks)),
        },
      });
    } catch (err) {
      // Another draft took the same "untitled-N" a moment ago: pick again.
      if ((err as { code?: string }).code !== "P2002" || attempt >= MAX_SLUG_ATTEMPTS) throw err;
    }
  }
}

export type EditorPost = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  status: PostStatus;
  blocks: unknown[];
  readingMinutes: number;
  reviewId: string | null;
  templateId: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  tags: string[];
  /** Set once the post has ever been public; its slug then stays put unless edited. */
  everPublished: boolean;
};

export type EditorTemplate = { id: string; name: string; category: Category | null; blocks: unknown[] };
export type EditorReviewOption = { id: string; label: string };

const KIND_LABEL = { FOOD: "Food", FILM: "Film", ALBUM: "Album", CONCERT: "Concert" } as const;

/** Everything the editor page needs, or null for an unknown post. */
export async function getPostForEditor(
  id: string,
): Promise<{ post: EditorPost; templates: EditorTemplate[]; reviews: EditorReviewOption[] } | null> {
  const row = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      status: true,
      blocks: true,
      readingMinutes: true,
      reviewId: true,
      templateId: true,
      coverMediaId: true,
      publishedAt: true,
      coverMedia: { select: { blobUrl: true, width: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!row) return null;

  const [templates, reviews] = await Promise.all([
    db.template.findMany({
      orderBy: [{ builtIn: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, category: true, blocks: true },
    }),
    db.review.findMany({
      where: { OR: [{ post: null }, { post: { id } }] },
      orderBy: { date: "desc" },
      select: { id: true, kind: true, title: true, rating: true, year: true, filmLog: { select: { year: true } } },
    }),
  ]);

  return {
    post: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      status: row.status,
      blocks: row.blocks as unknown[],
      readingMinutes: row.readingMinutes,
      reviewId: row.reviewId,
      templateId: row.templateId,
      coverMediaId: row.coverMediaId,
      coverUrl: row.coverMedia ? mediaUrl(row.coverMedia, 960) : null,
      tags: row.tags.map((t) => t.tag.name).sort((a, b) => a.localeCompare(b)),
      everPublished: row.publishedAt !== null,
    },
    templates: templates.map((t) => ({ ...t, blocks: t.blocks as unknown[] })),
    reviews: reviews.map((r) => {
      const year = r.kind === "FILM" ? (r.filmLog?.year ?? r.year) : null;
      return { id: r.id, label: `${r.title}${year ? ` (${year})` : ""} · ${KIND_LABEL[r.kind]} · ${r.rating}` };
    }),
  };
}

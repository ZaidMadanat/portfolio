import { cached, TAGS } from "@/lib/cache";
import { type BlogCategory, categoryLabel } from "@/lib/categories";
import { db } from "@/lib/db";
import { SITE_TIME_ZONE } from "@/lib/format";

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  tags: string[];
  /** ISO timestamp. */
  publishedAt: string;
  /** Publication year in Berkeley time, e.g. "2026". */
  year: string;
  readingMinutes: number;
  /** The linked review's rating, if any. */
  rating: number | null;
};

const yearIn = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: SITE_TIME_ZONE }).format(d);

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  publishedAt: true,
  readingMinutes: true,
  review: { select: { rating: true } },
  tags: { select: { tag: { select: { name: true } } } },
} as const;

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: Parameters<typeof categoryLabel>[0];
  publishedAt: Date | null;
  readingMinutes: number;
  review: { rating: number } | null;
  tags: { tag: { name: string } }[];
};

function toSummary(p: SummaryRow): PostSummary {
  const publishedAt = p.publishedAt!;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: categoryLabel(p.category),
    tags: p.tags.map((t) => t.tag.name).sort((a, b) => a.localeCompare(b)),
    publishedAt: publishedAt.toISOString(),
    year: yearIn(publishedAt),
    readingMinutes: p.readingMinutes,
    rating: p.review?.rating ?? null,
  };
}

const published = { status: "PUBLISHED", publishedAt: { not: null } } as const;

const loadPublished = cached(
  async (): Promise<PostSummary[]> => {
    const rows = await db.post.findMany({
      where: published,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: summarySelect,
    });
    return rows.map(toSummary);
  },
  [TAGS.posts],
  "posts:published",
);

/** Every published post, newest first (spec §6.2). Tagged `posts`. */
export function getPublishedPosts(): Promise<PostSummary[]> {
  return loadPublished();
}

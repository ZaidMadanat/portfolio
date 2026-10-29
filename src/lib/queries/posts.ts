import type { ReviewKind } from "@/generated/prisma/enums";
import { cached, TAGS } from "@/lib/cache";
import { type BlogCategory, categoryLabel } from "@/lib/categories";
import { db } from "@/lib/db";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";
import { foodMeta, KIND_PAGE } from "./reviews";

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

async function queryPublished(): Promise<PostSummary[]> {
  const rows = await db.post.findMany({
    where: published,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: summarySelect,
  });
  return rows.map(toSummary);
}

const loadPublished = cached(queryPublished, [TAGS.posts], "posts:published");

/** Every published post, newest first (spec §6.2). Tagged `posts`. */
export function getPublishedPosts(): Promise<PostSummary[]> {
  return loadPublished();
}

const loadFeed = cached(queryPublished, [TAGS.rss, TAGS.posts], "rss:posts");

/** The same list for /rss.xml (spec §6.9). Tagged `rss` and `posts` (spec §7.3). */
export function getFeedPosts(): Promise<PostSummary[]> {
  return loadFeed();
}

// ---------------------------------------------------------------- post page

/** The rating box (spec §6.3). It always comes from Post.reviewId. */
export type RatingBoxData = {
  kind: ReviewKind;
  title: string;
  meta: string;
  rating: number;
  imageUrl?: string;
  /** The review's page. */
  href: string;
};

export type PostFull = PostSummary & { html: string; review: RatingBoxData | null };

export type PostLookup = { post: PostFull } | { redirectTo: string } | null;

const reviewSelect = {
  kind: true,
  title: true,
  rating: true,
  date: true,
  cuisine: true,
  price: true,
  neighbourhood: true,
  city: true,
  artist: true,
  year: true,
  coverUrl: true,
  venue: true,
  filmLog: { select: { year: true, watchedAt: true, posterUrl: true } },
  photos: { orderBy: { order: "asc" }, take: 1, select: { media: { select: { blobUrl: true } } } },
} as const;

type ReviewRow = {
  kind: ReviewKind;
  title: string;
  rating: number;
  date: Date;
  cuisine: string | null;
  price: number | null;
  neighbourhood: string | null;
  city: string | null;
  artist: string | null;
  year: number | null;
  coverUrl: string | null;
  venue: string | null;
  filmLog: { year: number; watchedAt: Date; posterUrl: string | null } | null;
  photos: { media: { blobUrl: string } }[];
};

function toRatingBox(r: ReviewRow): RatingBoxData {
  const photo = r.photos[0]?.media.blobUrl;
  let title = r.title;
  let meta: string;
  let image: string | null | undefined;
  switch (r.kind) {
    case "FILM": {
      const year = r.filmLog?.year ?? r.year;
      if (year) title = `${r.title} (${year})`;
      meta = `Watched ${formatDate(r.filmLog?.watchedAt ?? r.date)}`;
      image = r.filmLog?.posterUrl || r.coverUrl || photo;
      break;
    }
    case "FOOD":
      meta = foodMeta(r);
      image = photo;
      break;
    case "ALBUM":
      meta = [r.artist, r.year].filter(Boolean).join(" · ");
      image = r.coverUrl || photo;
      break;
    case "CONCERT":
      meta = [r.artist, r.venue].filter(Boolean).join(" · ");
      image = photo || r.coverUrl;
      break;
  }
  return {
    kind: r.kind,
    title,
    meta,
    rating: r.rating,
    ...(image ? { imageUrl: image } : {}),
    href: KIND_PAGE[r.kind],
  };
}

/** Slug → post id, or the current slug for an old one. Tagged `posts`: every slug change is a post write. */
function resolveSlug(slug: string) {
  return cached(
    async (): Promise<{ id: string } | { redirectTo: string } | null> => {
      const post = await db.post.findFirst({ where: { slug, ...published }, select: { id: true } });
      if (post) return post;
      const redirect = await db.redirect.findUnique({
        where: { fromSlug: slug },
        select: { post: { select: { slug: true, status: true, publishedAt: true } } },
      });
      const target = redirect?.post;
      if (target && target.status === "PUBLISHED" && target.publishedAt) {
        return { redirectTo: `/blog/${target.slug}` };
      }
      return null;
    },
    [TAGS.posts],
    `posts:slug:${slug}`,
  )();
}

/** The full post. Also tagged `post:<id>`, which a review or media write revalidates (spec §7.3). */
function loadPost(id: string) {
  return cached(
    async (): Promise<PostFull | null> => {
      const row = await db.post.findFirst({
        where: { id, ...published },
        select: { ...summarySelect, html: true, review: { select: reviewSelect } },
      });
      if (!row) return null;
      return {
        ...toSummary(row),
        html: row.html,
        // A deleted review sets reviewId to null, so the box simply disappears.
        review: row.review ? toRatingBox(row.review) : null,
      };
    },
    [TAGS.posts, TAGS.post(id)],
    `post:${id}`,
  )();
}

/**
 * A published post by slug, a redirect for an old slug (spec §7.3), or null
 * (unknown slug, a draft, or an old slug of a draft).
 */
export async function getPostBySlug(slug: string): Promise<PostLookup> {
  const found = await resolveSlug(slug);
  if (!found || "redirectTo" in found) return found;
  const post = await loadPost(found.id);
  return post ? { post } : null;
}

const loadRedirectSlugs = cached(
  async (): Promise<string[]> => {
    const rows = await db.redirect.findMany({
      where: { post: published },
      orderBy: { fromSlug: "asc" },
      select: { fromSlug: true },
    });
    return rows.map((r) => r.fromSlug);
  },
  [TAGS.posts],
  "posts:redirect-slugs",
);

/**
 * Old slugs of published posts. The post page prerenders them too, so their
 * 308s are served from the build: Next 16.4.3 sends the Location header twice
 * on the first on-demand render of a redirect (cached responses are fine).
 */
export function getRedirectSlugs(): Promise<string[]> {
  return loadRedirectSlugs();
}

const KEEP_READING = 2;

/** Two other posts: the same category first, then the most recent (spec §6.3). */
export async function getKeepReading(post: { id: string; category: BlogCategory }): Promise<PostSummary[]> {
  const others = (await getPublishedPosts()).filter((p) => p.id !== post.id);
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, KEEP_READING);
}

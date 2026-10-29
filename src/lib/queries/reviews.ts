import type { ReviewKind } from "@/generated/prisma/enums";
import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { formatMonthDay, SITE_TIME_ZONE } from "@/lib/format";
import { displayedFilmRating } from "@/lib/rating";
import { foodMeta } from "@/lib/reviews/meta";

export { foodMeta };

export type FavoriteView = {
  position: number;
  title: string;
  year?: number;
  artist?: string;
  coverUrl?: string;
  rating?: number | null;
  href?: string;
};

export type LatestReview = {
  id: string;
  kind: ReviewKind;
  title: string;
  meta: string;
  rating: number;
  href: string;
};

export type ReviewsHub = {
  counts: { food: number; filmThisMonth: number };
  topFilms: FavoriteView[];
  topAlbums: FavoriteView[];
  latest: LatestReview[];
};

const LATEST_COUNT = 6;

/** Each review kind's public page. */
export const KIND_PAGE: Record<ReviewKind, string> = {
  FOOD: "/reviews/food",
  FILM: "/reviews/film",
  ALBUM: "/reviews/music",
  CONCERT: "/reviews/music",
};

type LinkedPost = { slug: string; status: "DRAFT" | "PUBLISHED" } | null | undefined;

/** A published linked post wins; otherwise the kind's own page. */
function reviewHref(post: LinkedPost, fallback: string): string {
  return post?.status === "PUBLISHED" ? `/blog/${post.slug}` : fallback;
}

/** First day of the current month in Berkeley, as the UTC-midnight date FilmLog.watchedAt uses. */
function monthStart(now: Date): Date {
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return new Date(`${ym}-01T00:00:00.000Z`);
}

const opt = <T,>(v: T | null | undefined): T | undefined => v ?? undefined;

const postSelect = { select: { slug: true, status: true } } as const;

const loadHub = cached(
  async (): Promise<ReviewsHub> => {
    const [food, filmThisMonth, favorites, reviews] = await Promise.all([
      db.review.count({ where: { kind: "FOOD" } }),
      db.filmLog.count({ where: { watchedAt: { gte: monthStart(new Date()) } } }),
      db.favorite.findMany({
        orderBy: { position: "asc" },
        include: {
          filmLog: { include: { review: { select: { kind: true, rating: true, post: postSelect } } } },
          review: { select: { rating: true, coverUrl: true, post: postSelect } },
        },
      }),
      db.review.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: LATEST_COUNT,
        include: { filmLog: { select: { watchedAt: true } }, post: postSelect },
      }),
    ]);

    const toView = (f: (typeof favorites)[number]): FavoriteView => {
      const logReview = f.filmLog?.review?.kind === "FILM" ? f.filmLog.review : null;
      const rating = f.filmLog ? displayedFilmRating(f.filmLog, logReview) : (f.review?.rating ?? null);
      const post = f.review?.post ?? logReview?.post;
      return {
        position: f.position,
        title: f.title,
        year: opt(f.year ?? f.filmLog?.year),
        artist: opt(f.artist),
        coverUrl: opt(f.coverUrl || f.filmLog?.posterUrl || f.review?.coverUrl),
        rating,
        href: reviewHref(post, f.kind === "FILM" ? KIND_PAGE.FILM : KIND_PAGE.ALBUM),
      };
    };

    const latest = reviews.map((r): LatestReview => {
      let meta: string;
      switch (r.kind) {
        case "FOOD":
          meta = foodMeta(r);
          break;
        case "FILM":
          meta = `Watched ${formatMonthDay(r.filmLog?.watchedAt ?? r.date)}`;
          break;
        case "ALBUM":
          meta = [r.artist, r.year].filter(Boolean).join(" · ");
          break;
        case "CONCERT":
          meta = r.venue ?? "";
          break;
      }
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        meta,
        rating: r.rating,
        href: reviewHref(r.post, KIND_PAGE[r.kind]),
      };
    });

    return {
      counts: { food, filmThisMonth },
      topFilms: favorites.filter((f) => f.kind === "FILM").map(toView),
      topAlbums: favorites.filter((f) => f.kind === "ALBUM").map(toView),
      latest,
    };
  },
  [TAGS.reviews, TAGS.films],
  "reviews:hub",
);

/** The /reviews hub data (spec §6.4). Empty tables give zero counts and empty lists. */
export function getReviewsHub(): Promise<ReviewsHub> {
  return loadHub();
}

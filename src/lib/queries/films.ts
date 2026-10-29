import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { displayedFilmRating } from "@/lib/rating";

export { monthStats } from "@/lib/film-stats";

// The /reviews/film data (spec §6.6): the most recent Letterboxd diary entries,
// plus hand-entered FILM reviews that have no diary entry, in one grid.

export type FilmCard = {
  /** A FilmLog's id, or `review:<id>` for a manual FILM review: unique across both. */
  id: string;
  title: string;
  /** Always set for a log; a manual review's year is optional. */
  year: number | null;
  /** Letterboxd stars, 0.5–5; null when unrated (and for a manual review). */
  stars: number | null;
  /** The displayed rating: a linked FILM review's, else the log's (stars ×2). */
  rating: number | null;
  /** The diary day, "YYYY-MM-DD" (FilmLog.watchedAt, or a manual review's Review.date, in UTC). */
  watchedAt: string;
  posterUrl: string | null;
  /** The review's post, only when it's published. */
  href: string | null;
  /** A FILM review is linked to this log, or the card is one. */
  hasReview: boolean;
};

const postSelect = { select: { slug: true, status: true } } as const;

const postHref = (post: { slug: string; status: string } | null | undefined) =>
  post?.status === "PUBLISHED" ? `/blog/${post.slug}` : null;

/** Newest day first, then by the unique id (descending), so ties never shuffle. */
const newestFirst = (a: FilmCard, b: FilmCard) =>
  a.watchedAt === b.watchedAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.watchedAt < b.watchedAt ? 1 : -1;

function loadFilmLogs(limit: number) {
  return cached(
    async (): Promise<FilmCard[]> => {
      const [logs, manual] = await Promise.all([
        db.filmLog.findMany({
          orderBy: [{ watchedAt: "desc" }, { id: "desc" }],
          take: limit,
          include: { review: { select: { kind: true, rating: true, post: postSelect } } },
        }),
        db.review.findMany({
          where: { kind: "FILM", filmLogId: null },
          orderBy: [{ date: "desc" }, { id: "desc" }],
          take: limit,
          select: { id: true, title: true, year: true, rating: true, date: true, post: postSelect },
        }),
      ]);
      const cards: FilmCard[] = [
        ...logs.map((l) => {
          const review = l.review?.kind === "FILM" ? l.review : null;
          return {
            id: l.id,
            title: l.title,
            year: l.year,
            stars: l.stars == null ? null : Number(l.stars),
            rating: displayedFilmRating(l, review),
            watchedAt: l.watchedAt.toISOString().slice(0, 10),
            posterUrl: l.posterUrl || null,
            href: postHref(review?.post),
            hasReview: Boolean(review),
          };
        }),
        ...manual.map((r) => ({
          id: `review:${r.id}`,
          title: r.title,
          year: r.year,
          stars: null,
          rating: r.rating,
          watchedAt: r.date.toISOString().slice(0, 10),
          posterUrl: null,
          href: postHref(r.post),
          hasReview: true,
        })),
      ];
      return cards.sort(newestFirst).slice(0, limit);
    },
    [TAGS.films, TAGS.reviews],
    `films:logs:${limit}`,
  )();
}

/**
 * Diary logs and manual FILM reviews together: newest day first, then by id.
 * Empty when there are neither.
 */
export function getFilmLogs(limit = 60): Promise<FilmCard[]> {
  return loadFilmLogs(limit);
}

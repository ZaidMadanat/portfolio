import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { displayedFilmRating } from "@/lib/rating";

export { monthStats } from "@/lib/film-stats";

// The /reviews/film data (spec §6.6): the most recent Letterboxd diary entries.

export type FilmCard = {
  id: string;
  title: string;
  year: number;
  /** Letterboxd stars, 0.5–5; null when unrated. */
  stars: number | null;
  /** The displayed rating: a linked FILM review's, else the log's (stars ×2). */
  rating: number | null;
  /** The diary day, "YYYY-MM-DD" (FilmLog.watchedAt is a calendar date). */
  watchedAt: string;
  posterUrl: string | null;
  /** The linked review's post, only when it's published. */
  href: string | null;
  /** A FILM review is linked to this log. */
  hasReview: boolean;
};

function loadFilmLogs(limit: number) {
  return cached(
    async (): Promise<FilmCard[]> => {
      const rows = await db.filmLog.findMany({
        orderBy: [{ watchedAt: "desc" }, { id: "desc" }],
        take: limit,
        include: { review: { select: { kind: true, rating: true, post: { select: { slug: true, status: true } } } } },
      });
      return rows.map((l) => {
        const review = l.review?.kind === "FILM" ? l.review : null;
        return {
          id: l.id,
          title: l.title,
          year: l.year,
          stars: l.stars == null ? null : Number(l.stars),
          rating: displayedFilmRating(l, review),
          watchedAt: l.watchedAt.toISOString().slice(0, 10),
          posterUrl: l.posterUrl || null,
          href: review?.post?.status === "PUBLISHED" ? `/blog/${review.post.slug}` : null,
          hasReview: Boolean(review),
        };
      });
    },
    [TAGS.films, TAGS.reviews],
    `films:logs:${limit}`,
  )();
}

/** Newest diary day first, then by id. Empty when nothing has been logged. */
export function getFilmLogs(limit = 60): Promise<FilmCard[]> {
  return loadFilmLogs(limit);
}

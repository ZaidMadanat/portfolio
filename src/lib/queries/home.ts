import type { Category } from "@/generated/prisma/enums";
import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { displayedFilmRating } from "@/lib/rating";
import { type StravaSummary, summarizeStrava } from "@/lib/strava-summary";
import { getRecentStravaActivities, type StravaActivityView } from "./strava";

export type HomeLastFilm = {
  title: string;
  year: number;
  rating: number | null;
  /** ISO date (UTC midnight). */
  watchedAt: string;
  posterUrl: string | null;
};

export type HomeTopAlbum = { title: string; artist: string; coverUrl: string | null };

export type HomeLatestPost = {
  slug: string;
  title: string;
  category: Category;
  /** ISO timestamp. */
  publishedAt: string;
  readingMinutes: number;
};

export type HomeData = {
  strava: StravaSummary<StravaActivityView>;
  lastFilm: HomeLastFilm | null;
  topAlbum: HomeTopAlbum | null;
  latestPost: HomeLatestPost | null;
};

// "Lately" (spec §6.1). Empty tables give nulls and the cards hide.
const loadLately = cached(
  async () => {
    const [log, album, post] = await Promise.all([
      db.filmLog.findFirst({
        orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: { review: { select: { kind: true, rating: true } } },
      }),
      db.albumListen.findFirst({ orderBy: [{ rank: "asc" }, { id: "asc" }] }),
      db.post.findFirst({
        where: { status: "PUBLISHED", publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: { slug: true, title: true, category: true, publishedAt: true, readingMinutes: true },
      }),
    ]);

    const lastFilm: HomeLastFilm | null = log && {
      title: log.title,
      year: log.year,
      rating: displayedFilmRating(log, log.review?.kind === "FILM" ? log.review : null),
      watchedAt: log.watchedAt.toISOString(),
      posterUrl: log.posterUrl,
    };
    const topAlbum: HomeTopAlbum | null = album && {
      title: album.title,
      artist: album.artist,
      coverUrl: album.coverUrl || null,
    };
    const latestPost: HomeLatestPost | null = post && {
      ...post,
      publishedAt: post.publishedAt!.toISOString(),
    };
    return { lastFilm, topAlbum, latestPost };
  },
  [TAGS.home],
  "home:lately",
);

/** Everything the home page reads, all tagged `home`. */
export async function getHomeData(): Promise<HomeData> {
  const [lately, activities] = await Promise.all([loadLately(), getRecentStravaActivities()]);
  return { strava: summarizeStrava(activities, new Date()), ...lately };
}

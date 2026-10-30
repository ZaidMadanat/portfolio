import type { FavoriteKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatMonthDay } from "@/lib/format";
import type { FavouriteChoice, FavouriteItem } from "./favourite-items";

export { MAX_FAVOURITES, type FavouriteChoice, type FavouriteItem } from "./favourite-items";

// The favourites admin's reads (spec §7 Favourites): the current top 4 films
// and albums, and what Swap / Add can pick from. Callers check the admin
// session.

export type FavouritesAdmin = {
  films: FavouriteItem[];
  albums: FavouriteItem[];
  filmChoices: FavouriteChoice[];
  albumChoices: FavouriteChoice[];
};

/** How many recent diary entries the film picker offers. */
const DIARY_CHOICES = 100;

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === "" ? undefined : v);

/** Drops undefined keys, so items compare and serialise cleanly. */
function item(i: FavouriteItem): FavouriteItem {
  return Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) as FavouriteItem;
}

const withYear = (title: string, year: number | undefined) => (year ? `${title} (${year})` : title);

export async function getFavouritesAdmin(): Promise<FavouritesAdmin> {
  const [favourites, filmReviews, logs, albumReviews, listens] = await Promise.all([
    db.favorite.findMany({ orderBy: [{ kind: "asc" }, { position: "asc" }] }),
    db.review.findMany({
      where: { kind: "FILM" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, year: true, rating: true, coverUrl: true, filmLog: { select: { year: true, posterUrl: true } } },
    }),
    db.filmLog.findMany({
      orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: DIARY_CHOICES,
      select: { id: true, title: true, year: true, posterUrl: true, watchedAt: true },
    }),
    db.review.findMany({
      where: { kind: "ALBUM" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, artist: true, year: true, rating: true, coverUrl: true },
    }),
    db.albumListen.findMany({ orderBy: [{ rank: "asc" }, { id: "asc" }] }),
  ]);

  const current = (kind: FavoriteKind) =>
    favourites
      .filter((f) => f.kind === kind)
      .map((f) => {
        const ref = f.filmLogId ? { filmLogId: f.filmLogId } : f.reviewId ? { reviewId: f.reviewId } : undefined;
        return item({ ref, title: f.title, artist: opt(f.artist), year: opt(f.year), coverUrl: opt(f.coverUrl) });
      });

  const filmChoices: FavouriteChoice[] = filmReviews.map((r) => {
    const year = opt(r.year ?? r.filmLog?.year);
    return {
      key: `review:${r.id}`,
      group: "Film reviews",
      label: `${withYear(r.title, year)} · ${r.rating}/10`,
      item: item({ ref: { reviewId: r.id }, title: r.title, year, coverUrl: opt(r.filmLog?.posterUrl ?? r.coverUrl) }),
    };
  });
  // A rewatch is the same film: offer it once, from its latest entry.
  const seen = new Set<string>();
  for (const l of logs) {
    const film = `${l.title.toLowerCase()}|${l.year}`;
    if (seen.has(film)) continue;
    seen.add(film);
    filmChoices.push({
      key: `log:${l.id}`,
      group: "From the diary",
      label: `${withYear(l.title, l.year)} · ${formatMonthDay(l.watchedAt)}`,
      item: item({ ref: { filmLogId: l.id }, title: l.title, year: l.year, coverUrl: opt(l.posterUrl) }),
    });
  }

  const albumChoices: FavouriteChoice[] = [
    ...albumReviews.map((r) => ({
      key: `review:${r.id}`,
      group: "Album reviews",
      label: [r.title, r.artist, `${r.rating}/10`].filter(Boolean).join(" · "),
      item: item({ ref: { reviewId: r.id }, title: r.title, artist: opt(r.artist), year: opt(r.year), coverUrl: opt(r.coverUrl) }),
    })),
    // This week's listening has no row to point at: it's kept as a snapshot.
    ...listens.map((a) => ({
      key: `listen:${a.id}`,
      group: "This week's listening",
      label: `${a.title} · ${a.artist}`,
      item: item({ title: a.title, artist: a.artist, year: opt(a.year), coverUrl: opt(a.coverUrl) }),
    })),
  ];

  return { films: current("FILM"), albums: current("ALBUM"), filmChoices, albumChoices };
}

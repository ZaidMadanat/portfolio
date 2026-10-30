import type { ReviewKind } from "@/generated/prisma/client";
import {
  emptyAlbum,
  emptyConcert,
  emptyFilm,
  emptyFood,
  REVIEW_KINDS,
  type AlbumOption,
  type FilmLogOption,
  type ReviewFormState,
} from "@/lib/admin/review-form";
import { BASE_CUISINES } from "@/lib/cuisines";
import { db } from "@/lib/db";
import { formatMonthDay } from "@/lib/format";
import { mediaUrl } from "@/lib/media/urls";
import { starsToTen } from "@/lib/rating";
import { cityToRegion } from "@/lib/regions";
import { foodMeta } from "@/lib/reviews/meta";

// The review admin's reads (spec §7 Reviews): the list, the form's pickers and
// a saved review loaded back into the form. Callers check the admin session.

/** "Write one now" starts a draft from the matching built-in template (seeded ids). */
export const REVIEW_TEMPLATE_IDS: Record<ReviewKind, string> = {
  FOOD: "builtin-restaurant",
  FILM: "builtin-film",
  ALBUM: "builtin-album",
  CONCERT: "builtin-concert",
};

/** How many recent diary entries the Film tab offers. */
export const FILM_LOG_OPTIONS = 60;

/** `?kind=` (any case) → a review kind, or null for anything else. */
export function parseReviewKind(value: string | string[] | undefined): ReviewKind | null {
  const v = (Array.isArray(value) ? value[0] : value)?.toUpperCase();
  return REVIEW_KINDS.find((k) => k === v) ?? null;
}

// ---------------------------------------------------------------- the list

export type AdminReviewRow = {
  id: string;
  kind: ReviewKind;
  title: string;
  rating: number;
  date: Date;
  meta: string;
  post: { id: string; title: string } | null;
};

export type ReviewCounts = Record<"all" | ReviewKind, number>;

const ORDER = [{ date: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

/** Every review (or one kind's), newest first, plus counts per kind. */
export async function listAdminReviews(kind: ReviewKind | null): Promise<{ rows: AdminReviewRow[]; counts: ReviewCounts }> {
  const [rows, grouped] = await Promise.all([
    db.review.findMany({
      where: kind ? { kind } : undefined,
      orderBy: ORDER,
      select: {
        id: true,
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
        venue: true,
        filmLog: { select: { watchedAt: true } },
        post: { select: { id: true, title: true } },
      },
    }),
    db.review.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const count = (k: ReviewKind) => grouped.find((g) => g.kind === k)?._count._all ?? 0;
  const counts = Object.fromEntries(REVIEW_KINDS.map((k) => [k, count(k)])) as Record<ReviewKind, number>;

  return {
    rows: rows.map((r) => {
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
      return { id: r.id, kind: r.kind, title: r.title, rating: r.rating, date: r.date, meta, post: r.post };
    }),
    counts: { all: REVIEW_KINDS.reduce((n, k) => n + counts[k], 0), ...counts },
  };
}

// ---------------------------------------------------------------- the form

export type PostOption = { id: string; label: string };

export type ReviewFormOptions = {
  filmLogs: FilmLogOption[];
  albums: AlbumOption[];
  /** Posts with no review, plus the one linked to this review. */
  posts: PostOption[];
  /** The base list, then custom cuisines already used (A–Z). */
  cuisines: string[];
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Everything the form's pickers offer. `reviewId` is the review being edited (null for a new one). */
export async function getReviewFormOptions(reviewId: string | null): Promise<ReviewFormOptions> {
  const logSelect = { id: true, title: true, year: true, stars: true, watchedAt: true, review: { select: { id: true } } } as const;
  const [logs, listens, posts, used, own] = await Promise.all([
    db.filmLog.findMany({
      orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: FILM_LOG_OPTIONS,
      select: logSelect,
    }),
    db.albumListen.findMany({ orderBy: [{ rank: "asc" }, { id: "asc" }] }),
    db.post.findMany({
      where: reviewId ? { OR: [{ reviewId: null }, { reviewId }] } : { reviewId: null },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, status: true },
    }),
    db.review.findMany({ where: { cuisine: { not: null } }, distinct: ["cuisine"], select: { cuisine: true } }),
    // The log this review already uses, in case it's older than the recent ones.
    reviewId
      ? db.review.findUnique({ where: { id: reviewId }, select: { filmLog: { select: logSelect } } })
      : Promise.resolve(null),
  ]);

  const allLogs = own?.filmLog && !logs.some((l) => l.id === own.filmLog!.id) ? [...logs, own.filmLog] : logs;
  const filmLogs = allLogs.map((l): FilmLogOption => {
    const rating = starsToTen(l.stars === null ? null : Number(l.stars));
    const reviewed = l.review !== null && l.review.id !== reviewId;
    const parts = [`${l.title} (${l.year})`, formatMonthDay(l.watchedAt), rating ? `${rating}/10` : "no rating"];
    if (reviewed) parts.push("has a review");
    return { id: l.id, title: l.title, year: l.year, rating, watchedAt: isoDay(l.watchedAt), label: parts.join(" · "), reviewed };
  });

  const base = new Set(BASE_CUISINES.map((c) => c.toLowerCase()));
  const custom = [
    ...new Map(
      used
        .map((r) => r.cuisine!.trim())
        .filter((c) => c && !base.has(c.toLowerCase()))
        .map((c) => [c.toLowerCase(), c] as const),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  return {
    filmLogs,
    albums: listens.map((a) => ({ id: a.id, title: a.title, artist: a.artist, year: a.year, coverUrl: a.coverUrl, statsfmAlbumId: a.statsfmAlbumId })),
    posts: posts.map((p) => ({ id: p.id, label: `${p.title.trim() || "Untitled draft"}${p.status === "DRAFT" ? " (draft)" : ""}` })),
    cuisines: [...BASE_CUISINES, ...custom],
  };
}

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** A saved review as the form's state, or null for an unknown id. */
export async function getReviewFormState(id: string): Promise<ReviewFormState | null> {
  const r = await db.review.findUnique({
    where: { id },
    include: {
      dishes: { orderBy: [{ order: "asc" }, { id: "asc" }] },
      photos: { orderBy: [{ order: "asc" }, { mediaId: "asc" }], include: { media: { select: { blobUrl: true, width: true } } } },
      filmLog: { select: { year: true } },
      post: { select: { id: true } },
    },
  });
  if (!r) return null;

  const food = emptyFood();
  const film = emptyFilm();
  const album = emptyAlbum();
  const concert = emptyConcert();
  switch (r.kind) {
    case "FOOD":
      Object.assign(food, {
        title: r.title,
        address: str(r.address),
        lat: str(r.lat),
        lng: str(r.lng),
        neighbourhood: str(r.neighbourhood),
        city: str(r.city),
        region: r.region ?? "",
        // A stored region that the city wouldn't give was picked by hand: keep it.
        regionTouched: r.region !== null && r.region !== cityToRegion(r.city ?? ""),
        cuisine: str(r.cuisine),
        price: r.price,
        dishes: r.dishes.length
          ? r.dishes.map((d, i) => ({ key: `k${i + 1}`, name: d.name, mustOrder: d.mustOrder }))
          : food.dishes,
      });
      break;
    case "FILM":
      Object.assign(film, { filmLogId: r.filmLogId ?? "", title: r.title, year: str(r.filmLog?.year ?? r.year) });
      break;
    case "ALBUM":
      Object.assign(album, { title: r.title, artist: str(r.artist), year: str(r.year), coverUrl: str(r.coverUrl), statsfmAlbumId: str(r.statsfmAlbumId) });
      break;
    case "CONCERT":
      Object.assign(concert, { artist: str(r.artist), venue: str(r.venue), highlight: str(r.highlight) });
      break;
  }

  return {
    kind: r.kind,
    shared: {
      rating: r.rating,
      date: isoDay(r.date),
      photos: r.photos.map((p) => ({ id: p.mediaId, url: mediaUrl(p.media, 960) })),
      postId: r.post?.id ?? null,
    },
    food,
    film,
    album,
    concert,
  };
}

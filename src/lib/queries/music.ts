import { cached, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";

// The /reviews/music data (spec §6.7).

/** An AlbumListen row as the page shows it ("" cover → null). */
export type RotationAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  rank: number;
};

export type RatedAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  rating: number;
  coverUrl: string | null;
  /** The linked post's slug, only when that post is published. */
  postSlug: string | null;
};

export type Concert = {
  id: string;
  artist: string;
  venue: string;
  /** The show's day, "YYYY-MM-DD" (Review.date is UTC midnight). */
  date: string;
  highlight: string;
  rating: number;
};

export type Music = { rotation: RotationAlbum[]; rated: RatedAlbum[]; concerts: Concert[] };

/** "On rotation this week" shows at most this many albums. */
const ROTATION_SIZE = 6;

const postSelect = { select: { slug: true, status: true } } as const;

const loadMusic = cached(
  async (): Promise<Music> => {
    const [listens, albums, shows] = await Promise.all([
      db.albumListen.findMany({ orderBy: [{ rank: "asc" }, { id: "asc" }], take: ROTATION_SIZE }),
      db.review.findMany({
        where: { kind: "ALBUM" },
        orderBy: [{ rating: "desc" }, { date: "desc" }, { id: "asc" }],
        include: { post: postSelect },
      }),
      db.review.findMany({ where: { kind: "CONCERT" }, orderBy: [{ date: "desc" }, { id: "asc" }] }),
    ]);
    return {
      rotation: listens.map((l) => ({
        id: l.id,
        title: l.title,
        artist: l.artist,
        year: l.year,
        coverUrl: l.coverUrl || null,
        rank: l.rank,
      })),
      rated: albums.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist ?? "",
        year: r.year,
        rating: r.rating,
        coverUrl: r.coverUrl || null,
        postSlug: r.post?.status === "PUBLISHED" ? r.post.slug : null,
      })),
      concerts: shows.map((r) => ({
        id: r.id,
        artist: r.artist || r.title,
        venue: r.venue ?? "",
        date: r.date.toISOString().slice(0, 10),
        highlight: r.highlight ?? "",
        rating: r.rating,
      })),
    };
  },
  [TAGS.music, TAGS.reviews],
  "music:page",
);

/** Rotation by rank (≤ 6), rated albums by rating then date, concerts newest first. */
export function getMusic(): Promise<Music> {
  return loadMusic();
}

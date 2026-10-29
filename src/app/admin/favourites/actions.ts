"use server";

import { z } from "zod";
import type { FavoriteKind } from "@/generated/prisma/client";
import { MAX_FAVOURITES, type FavouriteItem } from "@/lib/admin/favourite-items";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateFor } from "@/lib/revalidate";

// The favourites admin's one write (spec §7 Favourites, §8 Favorite, §7.3).

const id = z.string().trim().min(1).max(64);
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "") || v === null ? undefined : v;
const isCoverUrl = (v: string) => /^https:\/\/\S+$/i.test(v) || /^\/(?!\/)\S*$/.test(v);

const favouriteItem = z.object({
  ref: z
    .object({ filmLogId: id.optional(), reviewId: id.optional() })
    .refine((r) => Boolean(r.filmLogId) !== Boolean(r.reviewId), { error: "A favourite points at one log or one review." })
    .optional(),
  title: z.string().trim().min(1).max(200),
  artist: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  year: z.preprocess(blankToUndefined, z.number().int().min(1).max(9999).optional()),
  coverUrl: z.preprocess(blankToUndefined, z.string().trim().max(2000).refine(isCoverUrl).optional()),
});

const favouritesInput = z.object({
  kind: z.enum(["FILM", "ALBUM"]),
  items: z.array(favouriteItem).max(MAX_FAVOURITES, { error: `At most ${MAX_FAVOURITES} favourites.` }),
});

type Snapshot = { title: string; artist: string | null; year: number | null; coverUrl: string | null; filmLogId: string | null; reviewId: string | null };

/**
 * Replaces one kind's favourites (positions 1–4, in the order given) in one
 * transaction. An item that points at a FilmLog or a review takes its title,
 * year, artist and cover from that row now (a snapshot), so it still shows if
 * the row goes away; anything else is kept as typed. Throws on more than 4
 * items, a missing or wrong-kind reference, or the same reference twice.
 * Expires the reviews hub (`reviews`) right away.
 */
export async function setFavorites(kind: FavoriteKind, items: FavouriteItem[]): Promise<void> {
  await requireAdmin();
  const input = favouritesInput.parse({ kind, items });

  const refs = input.items.flatMap((i) => (i.ref ? [i.ref.filmLogId ?? i.ref.reviewId!] : []));
  if (new Set(refs).size !== refs.length) throw new Error("duplicate");

  await db.$transaction(async (tx) => {
    const rows: Snapshot[] = [];
    for (const i of input.items) {
      const typed = { title: i.title, artist: i.artist ?? null, year: i.year ?? null, coverUrl: i.coverUrl ?? null };
      if (i.ref?.filmLogId) {
        if (input.kind !== "FILM") throw new Error("wrong-kind");
        const log = await tx.filmLog.findUnique({ where: { id: i.ref.filmLogId } });
        if (!log) throw new Error("not-found");
        rows.push({ title: log.title, artist: null, year: log.year, coverUrl: log.posterUrl ?? typed.coverUrl, filmLogId: log.id, reviewId: null });
      } else if (i.ref?.reviewId) {
        const review = await tx.review.findUnique({ where: { id: i.ref.reviewId }, include: { filmLog: { select: { year: true, posterUrl: true } } } });
        if (!review) throw new Error("not-found");
        if (review.kind !== input.kind) throw new Error("wrong-kind");
        rows.push(
          review.kind === "FILM"
            ? {
                title: review.title,
                artist: null,
                year: review.year ?? review.filmLog?.year ?? null,
                coverUrl: review.filmLog?.posterUrl ?? review.coverUrl ?? typed.coverUrl,
                filmLogId: null,
                reviewId: review.id,
              }
            : { title: review.title, artist: review.artist, year: review.year, coverUrl: review.coverUrl ?? typed.coverUrl, filmLogId: null, reviewId: review.id },
        );
      } else {
        rows.push({ ...typed, filmLogId: null, reviewId: null });
      }
    }
    await tx.favorite.deleteMany({ where: { kind: input.kind } });
    if (rows.length > 0) {
      await tx.favorite.createMany({ data: rows.map((r, i) => ({ kind: input.kind, position: i + 1, ...r })) });
    }
  });

  revalidateFor("favorites", undefined, { immediate: true });
}

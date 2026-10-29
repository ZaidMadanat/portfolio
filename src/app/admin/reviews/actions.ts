"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { geocode, type GeocodeResult } from "@/lib/geocode";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateFor } from "@/lib/revalidate";
import { type ParsedReview, type ReviewInput, reviewFieldErrors, reviewInput } from "@/lib/reviews/schema";

// The review form's actions (spec §3 Geocoding, §7 Reviews, §7.3). Each checks
// the admin session first. Public pages are expired with updateTag, so a save
// shows on the very next public load.

const recordId = z.string().trim().min(1).max(64);
const address = z.string().trim().min(3).max(300);

export type SaveReviewResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const MESSAGES = {
  invalid: "Some fields need a look before this can be saved.",
  notFound: "This review no longer exists. It may have been deleted in another tab.",
  photo: "A photo on this review is no longer in the library. Remove it and try again.",
  filmLog: "That film is no longer in the Letterboxd diary. Pick it again.",
  filmTaken: "That film log already has a review. Edit that one instead.",
  post: "That post no longer exists. Pick another one.",
  postTaken: "That post is already linked to another review. Unlink it there first, or pick another post.",
  race: "Something else changed this at the same moment. Reload and try again.",
} as const;

/** A friendly, expected failure: rolled back and returned, never thrown to the client. */
class ReviewError extends Error {}

const NO_KIND_FIELDS = {
  address: null,
  lat: null,
  lng: null,
  cuisine: null,
  price: null,
  neighbourhood: null,
  city: null,
  region: null,
  filmLogId: null,
  artist: null,
  year: null,
  coverUrl: null,
  statsfmAlbumId: null,
  venue: null,
  highlight: null,
};

/** Every Review column for this kind; the other kinds' columns are cleared. */
function columns(r: ParsedReview) {
  const shared = { kind: r.kind, rating: r.rating, date: r.date, ...NO_KIND_FIELDS };
  switch (r.kind) {
    case "FOOD":
      return {
        ...shared,
        title: r.title,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        cuisine: r.cuisine,
        price: r.price,
        neighbourhood: r.neighbourhood ?? null,
        city: r.city,
        region: r.region,
      };
    case "FILM":
      return { ...shared, title: r.title, filmLogId: r.filmLogId ?? null, year: r.year ?? null };
    case "ALBUM":
      return {
        ...shared,
        title: r.title,
        artist: r.artist,
        year: r.year ?? null,
        coverUrl: r.coverUrl ?? null,
        statsfmAlbumId: r.statsfmAlbumId ?? null,
      };
    case "CONCERT":
      return { ...shared, title: r.title ?? r.artist, artist: r.artist, venue: r.venue, highlight: r.highlight ?? null };
  }
}

const prismaCode = (err: unknown) => (err as { code?: unknown } | null)?.code;

/**
 * Creates (no `id`) or updates a review with its dishes (in order) and photos
 * (in order) in one transaction, and links or unlinks its post. `postId`
 * left out keeps the current link; null removes it. A post can carry one
 * review only (`Post.reviewId` is unique), so linking a post that already has
 * another review is refused with a message. Expires the review's tags and
 * every post whose rating box changed.
 */
export async function saveReview(input: ReviewInput, id?: string): Promise<SaveReviewResult> {
  await requireAdmin();
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid, fieldErrors: reviewFieldErrors(parsed.error) };
  const data = parsed.data;
  let rid: string | undefined;
  if (id !== undefined) {
    const checked = recordId.safeParse(id);
    if (!checked.success) return { ok: false, message: MESSAGES.notFound };
    rid = checked.data;
  }

  let saved: { reviewId: string; linkedPostId: string | null; touchedPostIds: string[] };
  try {
    saved = await db.$transaction(async (tx) => {
      const existing = rid
        ? await tx.review.findUnique({ where: { id: rid }, select: { post: { select: { id: true } } } })
        : null;
      if (rid && !existing) throw new ReviewError(MESSAGES.notFound);

      if (data.photos.length > 0) {
        const found = await tx.media.count({ where: { id: { in: data.photos } } });
        if (found !== data.photos.length) throw new ReviewError(MESSAGES.photo);
      }
      if (data.kind === "FILM" && data.filmLogId) {
        const log = await tx.filmLog.findUnique({ where: { id: data.filmLogId }, select: { review: { select: { id: true } } } });
        if (!log) throw new ReviewError(MESSAGES.filmLog);
        if (log.review && log.review.id !== rid) throw new ReviewError(MESSAGES.filmTaken);
      }
      if (data.postId) {
        const target = await tx.post.findUnique({ where: { id: data.postId }, select: { reviewId: true } });
        if (!target) throw new ReviewError(MESSAGES.post);
        if (target.reviewId && target.reviewId !== rid) throw new ReviewError(MESSAGES.postTaken);
      }

      const fields = columns(data);
      const dishes = data.kind === "FOOD" ? data.dishes.map((d, order) => ({ name: d.name, mustOrder: d.mustOrder, order })) : [];
      const photos = data.photos.map((mediaId, order) => ({ mediaId, order }));
      const review = rid
        ? await tx.review.update({
            where: { id: rid },
            data: { ...fields, dishes: { deleteMany: {}, create: dishes }, photos: { deleteMany: {}, create: photos } },
            select: { id: true },
          })
        : await tx.review.create({
            data: { ...fields, dishes: { create: dishes }, photos: { create: photos } },
            select: { id: true },
          });

      const oldPostId = existing?.post?.id ?? null;
      const linkedPostId = data.postId === undefined ? oldPostId : data.postId;
      if (oldPostId && oldPostId !== linkedPostId) {
        await tx.post.update({ where: { id: oldPostId }, data: { reviewId: null } });
      }
      if (linkedPostId && linkedPostId !== oldPostId) {
        await tx.post.update({ where: { id: linkedPostId }, data: { reviewId: review.id } });
      }
      const touchedPostIds = [...new Set([oldPostId, linkedPostId].filter((p): p is string => p !== null))];
      return { reviewId: review.id, linkedPostId, touchedPostIds };
    });
  } catch (err) {
    if (err instanceof ReviewError) return { ok: false, message: err.message };
    // A unique link (Post.reviewId, Review.filmLogId) or a photo changed between the checks and the write.
    if (prismaCode(err) === "P2002") return { ok: false, message: MESSAGES.race };
    if (prismaCode(err) === "P2003") return { ok: false, message: MESSAGES.photo };
    if (prismaCode(err) === "P2025") return { ok: false, message: rid ? MESSAGES.notFound : MESSAGES.race };
    throw err;
  }

  revalidateFor("review", { reviewId: saved.reviewId, postId: saved.linkedPostId ?? undefined }, { immediate: true });
  // The blog list shows a linked review's rating too, and an unlinked post loses its box.
  for (const postId of saved.touchedPostIds) revalidateFor("post", { postId }, { immediate: true });
  return { ok: true, id: saved.reviewId };
}

/**
 * Deletes a review (its dishes and photo links go with it; the photos stay in
 * the library). A linked post is unlinked first, so its rating box simply
 * disappears (Review Focus 5), and that post's pages are expired too. An
 * unknown id does nothing.
 */
export async function deleteReview(id: string): Promise<void> {
  await requireAdmin();
  const rid = recordId.parse(id);
  const linked = await db.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: rid }, select: { post: { select: { id: true } } } });
    if (!review) return undefined;
    await tx.post.updateMany({ where: { reviewId: rid }, data: { reviewId: null } });
    await tx.review.delete({ where: { id: rid } });
    return review.post?.id ?? null;
  });
  if (linked === undefined) return;
  revalidateFor("review", { reviewId: rid, postId: linked ?? undefined }, { immediate: true });
  if (linked) revalidateFor("post", { postId: linked }, { immediate: true });
}

/**
 * Geocodes the address field when it loses focus (spec §3). Null when nothing
 * matches; throws when Nominatim is unreachable (the form then asks for the
 * pin to be placed by hand).
 */
export async function geocodeAction(input: string): Promise<GeocodeResult | null> {
  await requireAdmin();
  return geocode(address.parse(input));
}

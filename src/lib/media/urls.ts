// Where a photo's sizes live (spec §7.1): media/<id>/<width>.webp, in Vercel
// Blob (https://<store>.public.blob.vercel-storage.com/media/...) or, in local
// dev, public/uploads (/uploads/media/...). Media.blobUrl is the largest size,
// so it's always a directly servable image; the other sizes sit next to it.

export const MEDIA_WIDTHS = [480, 960, 1600, 2400] as const;

/** The largest stored width. The browser already caps the long edge at 2400. */
export const MASTER_WIDTH = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const VARIANT_URL = /^(.*\/media\/[A-Za-z0-9_-]{1,64}\/)\d+\.webp$/;

export type MediaRef = { blobUrl: string; width: number };

/** The storage path of one size. */
export function mediaPath(id: string, width: number): string {
  if (!ID.test(id)) throw new Error("Invalid media id");
  if (!Number.isInteger(width) || width < 1) throw new Error("Invalid media width");
  return `media/${id}/${width}.webp`;
}

/** The widths stored for a photo whose largest size is `width` px wide (no upscaling). */
export function variantWidths(width: number): number[] {
  const master = Math.min(width, MASTER_WIDTH);
  return [...MEDIA_WIDTHS.filter((w) => w < master), master];
}

function urlFor(media: MediaRef, width: number): string {
  const base = VARIANT_URL.exec(media.blobUrl)?.[1];
  if (!base) throw new Error("Media.blobUrl isn't a media/<id>/<width>.webp URL");
  return `${base}${width}.webp`;
}

/** The URL of the smallest stored size at least `width` px wide, else the largest. */
export function mediaUrl(media: MediaRef, width: number): string {
  const widths = variantWidths(media.width);
  return urlFor(media, widths.find((w) => w >= width) ?? widths[widths.length - 1]);
}

/** `srcset` for `<img>` (served `unoptimized`), from the stored sizes only. */
export function mediaSrcSet(media: MediaRef): string {
  return variantWidths(media.width)
    .map((w) => `${urlFor(media, w)} ${w}w`)
    .join(", ");
}

/** A new cuid-shaped media id: "c" + time + randomness, lower-case alphanumerics. */
export function newMediaId(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");
  return `c${Date.now().toString(36)}${random}`;
}

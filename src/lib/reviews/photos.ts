// Review photo alt text. Browser-safe: no database or cache imports.

/** A review photo as public pages render it. */
export type ReviewPhoto = { url: string; alt: string };

/**
 * The photo library's alt text (Media.alt) wins. Only when it's blank does the
 * photo get a description built from the review: "Photo at La Taqueria", then
 * "Photo 2 at La Taqueria" for later ones, so a screen reader can tell them apart.
 */
export function reviewPhotoAlt(mediaAlt: string | null | undefined, subject: string, index = 0): string {
  const alt = mediaAlt?.trim();
  if (alt) return alt;
  return index > 0 ? `Photo ${index + 1} at ${subject}` : `Photo at ${subject}`;
}

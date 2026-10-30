import { db } from "@/lib/db";
import { extractMediaIds, withMediaAlt } from "./media-refs";
import { renderPostHtml } from "./render";

// A post's stored HTML (spec §7.2) with the photo library's alt text applied.
// Used on every post save and whenever a photo's alt text changes. Node only.

/**
 * Renders `blocks` to sanitised HTML using each library photo's alt text, and
 * returns the library photos the post uses (ids that exist in Media), which
 * become its PostMedia rows.
 */
export async function renderPostBlocks(blocks: unknown[]): Promise<{ html: string; mediaIds: string[] }> {
  const ids = extractMediaIds(blocks);
  const media =
    ids.length === 0
      ? []
      : await db.media.findMany({ where: { id: { in: ids } }, select: { id: true, alt: true } });
  const alts = new Map(media.map((m) => [m.id, m.alt]));
  // BlockNote fills default props into the blocks it renders: give it a copy.
  const html = await renderPostHtml(withMediaAlt(structuredClone(blocks), alts));
  return { html, mediaIds: ids.filter((id) => alts.has(id)) };
}

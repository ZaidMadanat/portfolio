// Media ids referenced by a post's image blocks (spec §7.2: PostMedia rows).
// Photo URLs look like https://<store>.public.blob.vercel-storage.com/media/<id>/<width>.webp

const MEDIA_ID = /\/media\/([A-Za-z0-9_-]+)\//;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null;

function walk(blocks: unknown, out: Set<string>): void {
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    if (!isObj(block)) continue;
    if (block.type === "image" && isObj(block.props) && typeof block.props.url === "string") {
      const id = mediaIdFromUrl(block.props.url);
      if (id) out.add(id);
    }
    walk(block.children, out);
  }
}

/** Unique media ids from image block URLs, in document order. */
export function extractMediaIds(blocks: unknown[]): string[] {
  const ids = new Set<string>();
  walk(blocks, ids);
  return [...ids];
}

/** The library id in a photo URL (`…/media/<id>/<width>.webp`), or null. */
export function mediaIdFromUrl(url: string): string | null {
  return MEDIA_ID.exec(url)?.[1] ?? null;
}

function applyAlt(blocks: unknown, alts: ReadonlyMap<string, string>): unknown {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (!isObj(block)) return block;
    let next: Json = block;
    if (block.type === "image" && isObj(block.props) && typeof block.props.url === "string") {
      const id = mediaIdFromUrl(block.props.url);
      if (id !== null && alts.has(id)) next = { ...block, props: { ...block.props, name: alts.get(id) } };
    }
    if (Array.isArray(block.children)) next = { ...next, children: applyAlt(block.children, alts) };
    return next;
  });
}

/**
 * A copy of `blocks` whose library images use the photo library's alt text
 * (spec §7: editing alt text re-renders every post using the photo). BlockNote
 * renders an image's `name` as its alt, which the editor fills with the camera
 * filename, so a library photo's alt always comes from Media.alt, even when
 * it's empty (decorative). Images outside the library are left alone.
 */
export function withMediaAlt(blocks: unknown[], alts: ReadonlyMap<string, string>): unknown[] {
  return applyAlt(blocks, alts) as unknown[];
}

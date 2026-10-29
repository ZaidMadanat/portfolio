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
      const id = MEDIA_ID.exec(block.props.url)?.[1];
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

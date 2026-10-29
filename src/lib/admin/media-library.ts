import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media/urls";
import { NOT_USED } from "./media-labels";

// The photo library's reads (spec §7). "Used in" is derived from references:
// PostMedia (images in a post's body), Post.coverMediaId and ReviewMedia.

export { NOT_USED };

export type MediaItem = {
  id: string;
  filename: string;
  /** The smallest stored size that fills a grid tile. */
  thumbUrl: string;
  /** The master size: what Copy link copies. */
  url: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Labels such as "Post: Ben-Hur…" or "Review: La Taqueria"; empty when unused. */
  usedIn: string[];
};

const usageSelect = {
  posts: { select: { post: { select: { title: true, status: true } } } },
  coverOf: { select: { title: true, status: true } },
  reviews: { select: { review: { select: { title: true } } } },
} as const;

type UsageRow = {
  posts: { post: { title: string; status: string } }[];
  coverOf: { title: string; status: string }[];
  reviews: { review: { title: string } }[];
};

const MAX_TITLE = 48;
const short = (title: string) => {
  const t = title.trim() || "Untitled";
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
};
const postLabel = (p: { title: string; status: string }) =>
  `${p.status === "PUBLISHED" ? "Post" : "Draft"}: ${short(p.title)}`;
const sorted = (labels: string[]) => [...new Set(labels)].sort((a, b) => a.localeCompare(b));

/** Where a photo is used: posts, then covers, then reviews, each A–Z. */
function usageLabels(row: UsageRow): string[] {
  return [
    ...sorted(row.posts.map((p) => postLabel(p.post))),
    ...sorted(row.coverOf.map((p) => `${postLabel(p)} (cover)`)),
    ...sorted(row.reviews.map((r) => `Review: ${short(r.review.title)}`)),
  ];
}

/** Usage labels for one photo, or null if it doesn't exist. */
export async function mediaUsage(id: string): Promise<string[] | null> {
  const row = await db.media.findUnique({ where: { id }, select: usageSelect });
  return row ? usageLabels(row) : null;
}

/** Every photo, newest first, with where it's used. */
export async function getMediaLibrary(): Promise<MediaItem[]> {
  const rows = await db.media.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      blobUrl: true,
      filename: true,
      width: true,
      height: true,
      bytes: true,
      alt: true,
      createdAt: true,
      ...usageSelect,
    },
  });
  return rows.map((m) => ({
    id: m.id,
    filename: m.filename,
    thumbUrl: mediaUrl(m, 480),
    url: m.blobUrl,
    width: m.width,
    height: m.height,
    bytes: m.bytes,
    alt: m.alt,
    createdAt: m.createdAt.toISOString(),
    usedIn: usageLabels(m),
  }));
}

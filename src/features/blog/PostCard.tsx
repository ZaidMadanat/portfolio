import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { BlogCategory } from "@/lib/categories";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";
import type { PostSummary } from "@/lib/queries/posts";

// Pill tone per category, from the canvas Blog board.
export const CATEGORY_TONE: Record<BlogCategory, "soft" | "soft2"> = {
  Notes: "soft2",
  Statistics: "soft",
  "Computer Science": "soft2",
  Philosophy: "soft2",
  Film: "soft",
  Food: "soft",
  Music: "soft2",
  Projects: "soft2",
};

export function CategoryPill({ category }: { category: BlogCategory }) {
  return (
    <Pill tone={CATEGORY_TONE[category]} className="text-xs tracking-[0.05em] uppercase">
      {category}
    </Pill>
  );
}

/** "Tags: a, b" as plain text (spec §6.2: no `#` anywhere), or null with no tags. */
export function tagLine(tags: string[]): string | null {
  return tags.length ? `Tags: ${tags.join(", ")}` : null;
}

// The title link stretches over the whole card, so the card is one target
// with a short accessible name.
export function PostCard({ post }: { post: PostSummary }) {
  const tags = tagLine(post.tags);
  return (
    <Card as="article" lift className="relative flex h-full gap-5 p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill category={post.category} />
          <span className="text-sm text-muted">
            {formatDate(post.publishedAt, SITE_TIME_ZONE)} · {post.readingMinutes} min read
          </span>
        </div>
        <h2 className="font-display text-2xl leading-tight font-extrabold text-balance">
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0 after:rounded-3xl after:content-['']"
          >
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className="leading-relaxed text-muted">{post.excerpt}</p> : null}
        {tags ? <p className="text-sm text-muted">{tags}</p> : null}
      </div>
      {post.rating != null ? <RatingStamp rating={post.rating} size="md" /> : null}
    </Card>
  );
}

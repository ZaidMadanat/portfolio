import Link from "next/link";
import type { ReactNode } from "react";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { RatingStamp } from "@/components/ui/RatingStamp";
import { categoryLabel } from "@/lib/categories";
import { formatMonthDay, SITE_TIME_ZONE } from "@/lib/format";
import type { HomeLastFilm, HomeLatestPost, HomeTopAlbum } from "@/lib/queries/home";

type Props = {
  lastFilm: HomeLastFilm | null;
  topAlbum: HomeTopAlbum | null;
  latestPost: HomeLatestPost | null;
};

const CARD =
  "lift flex min-w-0 gap-4 rounded-3xl border-2 border-ink p-5 text-ink shadow-hard sm:p-6";

function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.06em] text-muted uppercase">{children}</span>;
}

// Each card hides when its source is empty; the whole section hides when all are.
export function Lately({ lastFilm, topAlbum, latestPost }: Props) {
  if (!lastFilm && !topAlbum && !latestPost) return null;
  return (
    <section aria-labelledby="lately-heading" className="flex flex-col gap-5">
      <h2 id="lately-heading" className="font-display text-3xl font-bold">
        Lately
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lastFilm ? (
          <Link href="/reviews/film" className={`${CARD} items-center bg-soft`}>
            <span aria-hidden="true" className="w-16 shrink-0">
              <PosterBlock title={lastFilm.title} posterUrl={lastFilm.posterUrl} toneIndex={0} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Label>Last watched</Label>
              <span className="font-display text-xl leading-tight font-bold">
                {lastFilm.title} ({lastFilm.year})
              </span>
              <span className="text-sm text-muted">{formatMonthDay(lastFilm.watchedAt)}</span>
            </span>
            {lastFilm.rating != null ? <RatingStamp rating={lastFilm.rating} size="sm" /> : null}
          </Link>
        ) : null}

        {topAlbum ? (
          <Link href="/reviews/music" className={`${CARD} items-center bg-soft2`}>
            <AlbumCover coverUrl={topAlbum.coverUrl} toneIndex={0} size="md" />
            <span className="flex min-w-0 flex-col gap-1">
              <Label>On repeat</Label>
              <span className="font-display text-xl leading-tight font-bold">{topAlbum.title}</span>
              <span className="text-sm text-muted">{topAlbum.artist}</span>
            </span>
          </Link>
        ) : null}

        {latestPost ? (
          <Link href={`/blog/${latestPost.slug}`} className={`${CARD} flex-col bg-surface`}>
            <Label>Latest post</Label>
            <span className="font-display text-xl leading-tight font-bold">{latestPost.title}</span>
            <span className="text-sm text-muted">
              {categoryLabel(latestPost.category)} · {formatMonthDay(latestPost.publishedAt, SITE_TIME_ZONE)} ·{" "}
              {latestPost.readingMinutes} min read
            </span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

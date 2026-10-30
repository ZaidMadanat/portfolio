import Image from "next/image";
import Link from "next/link";
import type { ReviewKind } from "@/generated/prisma/enums";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { RatingBoxData } from "@/lib/queries/posts";

const KIND: Record<ReviewKind, { label: string; link: string }> = {
  FILM: { label: "Film review", link: "See it in my film log" },
  FOOD: { label: "Restaurant review", link: "See it on my food map" },
  ALBUM: { label: "Album review", link: "See it in my music" },
  CONCERT: { label: "Concert review", link: "See it in my music" },
};

function Artwork({ review }: { review: RatingBoxData }) {
  if (review.kind === "FILM") {
    return (
      <span aria-hidden="true" className="w-18 shrink-0 [grid-area:art] sm:w-21">
        <PosterBlock title={review.title} posterUrl={review.imageUrl} toneIndex={0} />
      </span>
    );
  }
  if (review.kind === "ALBUM") {
    return (
      <span className="[grid-area:art]">
        <AlbumCover coverUrl={review.imageUrl} toneIndex={0} size="md" />
      </span>
    );
  }
  if (!review.imageUrl) return null;
  return (
    <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-3 border-ink bg-soft [grid-area:art]">
      <Image src={review.imageUrl} alt={review.imageAlt ?? ""} fill unoptimized sizes="96px" className="object-cover" />
    </span>
  );
}

// Phones: artwork and stamp share the top row, the text sits below.
// From sm: artwork, text, stamp in one row.
// Rendered by the page template from Post.reviewId, never by an editor block (spec §6.3).
export function RatingBox({ review }: { review: RatingBoxData }) {
  const kind = KIND[review.kind];
  return (
    <aside
      aria-label="Rating"
      className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-3xl border-3 border-ink bg-surface p-5 shadow-hard-lg [grid-template-areas:'art_stamp'_'text_text'] sm:grid-cols-[auto_1fr_auto] sm:[grid-template-areas:'art_text_stamp']"
    >
      <Artwork review={review} />
      <div className="flex min-w-0 flex-col gap-1.5 [grid-area:text]">
        <span className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{kind.label}</span>
        <span className="font-display text-2xl leading-tight font-extrabold">{review.title}</span>
        {review.meta ? <span className="text-[15px] text-muted">{review.meta}</span> : null}
        <Link
          href={review.href}
          className="inline-flex min-h-11 items-center self-start font-bold text-accent-ink underline underline-offset-2"
        >
          {kind.link} →
        </Link>
      </div>
      <span className="justify-self-end [grid-area:stamp]">
        <RatingStamp rating={review.rating} size="lg" variant="filled" label />
      </span>
    </aside>
  );
}

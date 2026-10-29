import type { Metadata } from "next";
import { LatestReviews } from "@/features/reviews/LatestReviews";
import { SectionTiles } from "@/features/reviews/SectionTiles";
import { TopFour } from "@/features/reviews/TopFour";
import { getReviewsHub } from "@/lib/queries/reviews";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What Zaid Madanat is eating, watching and listening to, scored out of 10.",
};

// Static; rebuilt only when the `reviews` or `films` tag is revalidated (spec §7.3).
export const revalidate = false;

export default async function ReviewsPage() {
  const { counts, topFilms, topAlbums, latest } = await getReviewsHub();
  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight">
          Reviews
        </h1>
        <p className="max-w-[34em] text-lg leading-relaxed text-pretty text-muted sm:text-xl">
          What I&apos;m eating, watching and listening to. Everything is scored out of 10.
        </p>
      </header>
      <SectionTiles counts={counts} />
      <TopFour kind="film" items={topFilms} />
      <TopFour kind="album" items={topAlbums} />
      <LatestReviews items={latest} />
    </div>
  );
}

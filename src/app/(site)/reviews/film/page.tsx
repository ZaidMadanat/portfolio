import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilmFilters } from "@/features/film/FilmFilters";
import { FilmStats } from "@/features/film/FilmStats";
import { monthName } from "@/lib/film-stats";
import { getFilmLogs, monthStats } from "@/lib/queries/films";

export const metadata: Metadata = {
  title: "Film",
  description: "Films Zaid Madanat has been watching, with a score out of 10 and the occasional review.",
};

// Static; rebuilt only when the `films` or `reviews` tag is revalidated (spec §7.3).
// "This month" is worked out then too: the daily film sync keeps it current.
// The chips filter in the browser (FilmFilters), so the server never reads the query.
export const revalidate = false;

export default async function FilmPage() {
  const cards = await getFilmLogs();
  const now = new Date();
  const { count, average } = monthStats(cards, now);
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <Link href="/reviews" className="inline-flex min-h-11 items-center self-start font-semibold text-muted hover:text-ink">
            ← Reviews
          </Link>
          <h1 className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight text-balance">
            What I&apos;ve been watching
          </h1>
        </div>
        <FilmStats count={count} average={average} month={monthName(now)} />
      </header>
      {cards.length ? <FilmFilters cards={cards} /> : <EmptyState title="No films logged yet." />}
    </div>
  );
}

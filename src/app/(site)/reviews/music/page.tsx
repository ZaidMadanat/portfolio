import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Concerts } from "@/features/music/Concerts";
import { OnRotation } from "@/features/music/OnRotation";
import { RatedAlbums } from "@/features/music/RatedAlbums";
import { getMusic } from "@/lib/queries/music";

export const metadata: Metadata = {
  title: "Music",
  description: "What Zaid Madanat is listening to this week, the albums he's rated, and the concerts he's been to.",
};

// Static; rebuilt only when the `music` or `reviews` tag is revalidated (spec §7.3).
export const revalidate = false;

export default async function MusicPage() {
  const { rotation, rated, concerts } = await getMusic();
  // A section with nothing in it is left out, and so is its pill.
  const sections = [
    { id: "recent", label: "Recent", show: rotation.length > 0 },
    { id: "rated", label: "Rated albums", show: rated.length > 0 },
    { id: "concerts", label: "Concerts", show: concerts.length > 0 },
  ].filter((s) => s.show);
  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-col gap-4">
        <Link href="/reviews" className="inline-flex min-h-11 items-center self-start font-semibold text-muted hover:text-ink">
          ← Reviews
        </Link>
        <h1 className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight text-balance">
          What&apos;s in my ears
        </h1>
        {sections.length ? (
          <nav aria-label="Music sections" className="pt-1">
            <ul className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-4 py-2 font-bold text-ink hover:bg-soft"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      {rotation.length ? <OnRotation albums={rotation} id="recent" headingId="recent-heading" /> : null}
      {rated.length ? <RatedAlbums albums={rated} id="rated" headingId="rated-heading" /> : null}
      {concerts.length ? <Concerts concerts={concerts} id="concerts" headingId="concerts-heading" /> : null}
      {sections.length ? null : <EmptyState title="No music yet." />}
    </div>
  );
}

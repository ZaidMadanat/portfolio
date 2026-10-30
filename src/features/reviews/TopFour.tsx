import Link from "next/link";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { FavoriteView } from "@/lib/queries/reviews";
import { TopFourAdminPrompt } from "./TopFourAdminPrompt";

type Props = {
  kind: "film" | "album";
  items: FavoriteView[];
};

const COPY = {
  film: { heading: "My top 4 films", more: "Full film log", moreHref: "/reviews/film", fallback: "/reviews/film" },
  album: { heading: "My top 4 albums", more: "All music", moreHref: "/reviews/music", fallback: "/reviews/music" },
} as const;

const TILTS = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.5deg]"];

// With no favourites, visitors see nothing; the signed-in admin gets a "Pick
// your top 4 in the admin" prompt, decided in the browser so /reviews stays static.
export function TopFour({ kind, items }: Props) {
  if (items.length === 0) return <TopFourAdminPrompt kind={kind} />;
  const copy = COPY[kind];
  const headingId = `top-${kind}s`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-display text-3xl font-extrabold sm:text-4xl">
          {copy.heading}
        </h2>
        <Link
          href={copy.moreHref}
          className="inline-flex min-h-11 items-center font-bold text-accent-ink underline-offset-4 hover:underline"
        >
          {copy.more}
          <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
      <ul aria-label={copy.heading} className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {items.map((item, i) => (
          <li key={item.position} className="min-w-0">
            <Link href={item.href ?? copy.fallback} className="relative flex flex-col gap-2.5">
              <span aria-hidden="true" className={`lift block rounded-2xl ${TILTS[i % TILTS.length]}`}>
                {kind === "film" ? (
                  <PosterBlock title={item.title} posterUrl={item.coverUrl} toneIndex={i} />
                ) : (
                  <AlbumCover coverUrl={item.coverUrl} toneIndex={i} size="fill" />
                )}
              </span>
              {kind === "film" ? (
                <span className="font-bold">
                  {item.title}
                  {item.year ? <span className="font-normal text-muted"> ({item.year})</span> : null}
                </span>
              ) : (
                <span className="flex flex-col">
                  <span className="font-bold">{item.title}</span>
                  {item.artist ? <span className="text-muted">{item.artist}</span> : null}
                </span>
              )}
              {item.rating != null ? (
                <span className="absolute top-2 right-2">
                  <RatingStamp rating={item.rating} size="sm" />
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

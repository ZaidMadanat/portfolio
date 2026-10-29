import Link from "next/link";
import type { CSSProperties } from "react";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { RatingStamp } from "@/components/ui/RatingStamp";
import { starsLabel } from "@/lib/film-stats";
import { formatDate } from "@/lib/format";
import type { FilmCard } from "@/lib/queries/films";

// Poster tilts in degrees (spec §5 keeps them within ±0.5–2), as on the canvas.
const TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5];

// One card per log (spec §6.6): poster (or a coloured block with the title),
// the rating stamp (none when unrated), title, year, stars and date. A REVIEW
// tag marks a log with a linked review; when its post is published the title
// link stretches over the whole card.
export function FilmGrid({ cards }: { cards: FilmCard[] }) {
  return (
    <ul aria-label="Film logs" className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <FilmItem key={card.id} card={card} index={i} />
      ))}
    </ul>
  );
}

function FilmItem({ card, index }: { card: FilmCard; index: number }) {
  const stars = starsLabel(card.stars);
  const tilt = { "--tilt": `${TILTS[index % TILTS.length]}deg` } as CSSProperties;
  return (
    <li className="relative flex min-w-0 flex-col gap-2">
      <div style={tilt} className="tilt-ease relative rotate-(--tilt)">
        {/* The title below names the card; the poster is decoration. */}
        <div aria-hidden="true">
          <PosterBlock title={card.title} posterUrl={card.posterUrl} toneIndex={index} />
        </div>
        {card.rating != null ? (
          <span className="absolute top-2 right-2">
            <RatingStamp rating={card.rating} size="sm" variant={card.rating >= 9 ? "filled" : "dashed"} />
          </span>
        ) : null}
        {card.hasReview ? (
          <span
            data-testid="review-tag"
            className="absolute top-3 -left-2 -rotate-6 rounded-lg border-2 border-ink bg-accent px-2.5 py-1 text-xs font-extrabold tracking-[0.04em] text-on-accent uppercase"
          >
            Review
          </span>
        ) : null}
      </div>
      <h3 className="mt-1 leading-snug font-bold break-words">
        {card.href ? (
          <Link
            href={card.href}
            className="underline-offset-2 after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline"
          >
            {card.title}
          </Link>
        ) : (
          card.title
        )}{" "}
        <span className="font-normal text-muted">{card.year}</span>
      </h3>
      <p className="text-sm text-muted">
        {stars ? (
          <>
            <span aria-hidden="true">{stars}</span>
            <span className="sr-only">{card.stars} stars</span>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        <span className="whitespace-nowrap">{formatDate(card.watchedAt)}</span>
      </p>
    </li>
  );
}

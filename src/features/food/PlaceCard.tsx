import Image from "next/image";
import Link from "next/link";
import type { Ref } from "react";
import { RatingStamp } from "@/components/ui/RatingStamp";
import { formatDate } from "@/lib/format";
import type { Place } from "@/lib/queries/food";
import { foodMeta } from "@/lib/reviews/meta";

// The detail card for the selected place (spec §6.5): photos, name, cuisine ·
// price · neighbourhood, city, visit date, the rating stamp, what was ordered
// (the must-order dish highlighted) and the full review when a post is linked.

type Props = { place: Place; ref?: Ref<HTMLElement> };

export function PlaceCard({ place, ref }: Props) {
  const titleId = `place-${place.id}-title`;
  return (
    <article
      ref={ref}
      aria-labelledby={titleId}
      className="flex scroll-mt-6 flex-col overflow-hidden rounded-3xl border-2 border-ink bg-surface text-ink shadow-hard"
    >
      {place.photos.length ? <Photos name={place.name} photos={place.photos} /> : null}
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id={titleId} className="font-display text-3xl leading-tight font-extrabold break-words">
              {place.name}
            </h2>
            <p className="font-semibold break-words">{foodMeta(place)}</p>
            <p className="text-sm text-muted">Visited {formatDate(place.date)}</p>
          </div>
          <RatingStamp rating={place.rating} size="lg" label variant={place.rating >= 9 ? "filled" : "dashed"} />
        </div>

        <section aria-labelledby={`${titleId}-ordered`} className="flex flex-col gap-2.5">
          <h3 id={`${titleId}-ordered`} className="text-[13px] font-extrabold tracking-[0.08em] text-muted uppercase">
            What I ordered
          </h3>
          <ul className="flex flex-col gap-2">
            {place.dishes.map((d, i) =>
              d.mustOrder ? (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-2xl border-2 border-ink bg-soft px-4 py-3 font-bold"
                >
                  <span className="min-w-0 break-words">{d.name}</span>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold tracking-[0.08em] text-on-accent uppercase">
                    Must order
                  </span>
                </li>
              ) : (
                <li key={i} className="rounded-2xl border-2 border-line px-4 py-3 break-words">
                  {d.name}
                </li>
              ),
            )}
          </ul>
        </section>

        {place.postSlug ? (
          <Link
            href={`/blog/${place.postSlug}`}
            className="inline-flex min-h-11 items-center self-start rounded-2xl border-2 border-ink bg-ink px-5 py-2.5 font-bold text-bg"
          >
            Read the full review →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Photos({ name, photos }: { name: string; photos: string[] }) {
  const [first, ...rest] = photos;
  return (
    <div className="flex flex-col gap-2 border-b-2 border-ink bg-soft p-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <Image src={first} alt={`At ${name}`} fill unoptimized sizes="(min-width: 1024px) 26rem, 100vw" className="object-cover" />
      </div>
      {rest.length ? (
        <ul aria-label="More photos" className="relative flex gap-2 overflow-x-auto">
          {rest.map((src, i) => (
            <li key={src} className="relative size-20 shrink-0 overflow-hidden rounded-xl">
              <Image src={src} alt={`At ${name}, photo ${i + 2}`} fill unoptimized sizes="5rem" className="object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

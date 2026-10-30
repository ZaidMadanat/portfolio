import Link from "next/link";
import type { ReactNode } from "react";
import { plural, SITE_TIME_ZONE } from "@/lib/format";

type Props = { counts: { food: number; filmThisMonth: number } };

const TILE =
  "lift relative flex min-h-48 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-[32px] border-3 border-ink p-7 shadow-hard sm:min-h-56";

function Tile({
  href,
  tone,
  label,
  name,
  children,
}: {
  href: string;
  tone: string;
  label: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${TILE} ${tone}`}>
      {children}
      <span className="relative text-[13px] font-extrabold tracking-[0.08em] uppercase">{label}</span>
      <span className="relative font-display text-5xl leading-none font-extrabold sm:text-[3.5rem]">
        {name}
        <span aria-hidden="true"> →</span>
      </span>
    </Link>
  );
}

export function SectionTiles({ counts }: Props) {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: SITE_TIME_ZONE }).format(new Date());
  return (
    <nav aria-label="Review sections" className="grid gap-5 md:grid-cols-3">
      <Tile
        href="/reviews/food"
        tone="bg-accent text-on-accent"
        label={counts.food ? `${plural(counts.food, "place")} · Bay Area map` : "Bay Area map"}
        name="Food"
      >
        <span aria-hidden="true" className="absolute -top-8 -right-8 size-36 rounded-full bg-bg opacity-35" />
      </Tile>
      <Tile
        href="/reviews/film"
        tone="bg-second text-on-second"
        label={counts.filmThisMonth ? `${plural(counts.filmThisMonth, "film")} in ${month}` : "Diary & ratings"}
        name="Film"
      >
        <span
          aria-hidden="true"
          className="absolute top-6 right-6 h-16 w-22 rotate-10 rounded-xl border-3 border-current"
        />
      </Tile>
      <Tile href="/reviews/music" tone="bg-ink text-bg" label="Albums & concerts" name="Music">
        <span
          aria-hidden="true"
          className="absolute -top-8 -right-8 size-28 rounded-full border-[16px] border-accent"
        />
      </Tile>
    </nav>
  );
}

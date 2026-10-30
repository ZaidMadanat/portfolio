"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FILM_FILTERS, filterFilms, type FilmFilter } from "@/lib/film-stats";
import type { FilmCard } from "@/lib/queries/films";
import { FilmGrid } from "./FilmGrid";

// The filter chips and the grid they drive (spec §6.6). Filtering happens in
// the browser so the page stays static; the static HTML shows every log.
export function FilmFilters({ cards }: { cards: FilmCard[] }) {
  const [filter, setFilter] = useState<FilmFilter>("all");
  const shown = filterFilms(cards, filter);
  return (
    <div className="flex flex-col gap-8">
      <div role="group" aria-label="Filter films" className="flex flex-wrap gap-2">
        {FILM_FILTERS.map((f) => {
          const on = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 cursor-pointer rounded-full border-2 border-ink px-4 py-2 font-bold ${
                on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {shown.length ? (
        <FilmGrid cards={shown} />
      ) : (
        <EmptyState title="No films match yet." onClear={() => setFilter("all")} />
      )}
    </div>
  );
}

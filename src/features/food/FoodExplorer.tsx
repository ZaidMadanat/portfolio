"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  bandTones,
  cuisineOptions,
  type FoodQuery,
  foodQueryString,
  filterPlaces,
  hasFoodFilters,
  parseFoodQuery,
  type PinTone,
  type Price,
  PRICES,
  RATING_BAND_LABELS,
  RATING_BANDS,
} from "@/lib/food-filters";
import { plural, priceLabel } from "@/lib/format";
import type { Place } from "@/lib/queries/food";
import type { RatingBand } from "@/lib/rating";
import { REGION_LABELS, REGIONS, type Region } from "@/lib/regions";
import { CuisineDropdown, FILTER_BUTTON } from "./CuisineDropdown";
import { MapPlaceholder } from "./MapPlaceholder";
import { PlaceCard } from "./PlaceCard";
import { PlaceList } from "./PlaceList";

// /reviews/food's filters, map, card and list (spec §6.5). The page is static
// (spec §3.1): the server never sees the query. The prerendered HTML is the
// Suspense fallback (every place, no filters); after hydration the URL
// drives it, as on /blog.

// MapLibre only loads here, in the browser, once the map's box is about to
// scroll into view (useNearViewport). On a phone the map sits below the fold,
// so a visitor who only reads the list never downloads or runs it.
const FoodMap = dynamic(() => import("./FoodMap").then((m) => m.FoodMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

/** How far ahead of the viewport the map starts loading. */
const MAP_LOAD_MARGIN = "200px 0px";

/** True from the first time `ref` comes within MAP_LOAD_MARGIN of the viewport. */
function useNearViewport(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setNear(true));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: MAP_LOAD_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, near]);
  return near;
}

type Props = { places: Place[] };

const EMPTY: FoodQuery = { cuisines: [] };

export function FoodExplorer({ places }: Props) {
  return (
    <Suspense fallback={<FoodIndex places={places} query={EMPTY} />}>
      <WithSearchParams places={places} />
    </Suspense>
  );
}

function WithSearchParams({ places }: Props) {
  const searchParams = useSearchParams();
  // The URL is read once; after that this state leads and the URL follows.
  // (useSearchParams only catches up with replaceState a moment later, and
  // the cuisine checkboxes are controlled, so they must change at once.)
  const [query, setQuery] = useState(() => parseFoodQuery(new URLSearchParams(searchParams.toString())));
  // As on /blog: native replaceState (synced with the Next router, no refetch).
  const onChange = (patch: Partial<FoodQuery> | null) => {
    const next = patch === null ? EMPTY : { ...query, ...patch };
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}${foodQueryString(next)}`);
  };
  return <FoodIndex places={places} query={query} onChange={onChange} />;
}

const LABEL = "text-[13px] font-bold text-muted";

const chip = (on: boolean) =>
  `${FILTER_BUTTON} rounded-full px-4 ${on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"}`;

const DOT: Record<PinTone, string> = {
  accent: "bg-accent",
  second: "bg-second",
  surface: "bg-surface",
};

function ChipGroup<T extends string | number>({
  label,
  any,
  values,
  current,
  name,
  dots,
  onPick,
}: {
  label: string;
  any: string;
  values: readonly T[];
  current: T | undefined;
  name: (v: T) => string;
  dots?: (v: T) => PinTone[];
  onPick: (v: T | undefined) => void;
}) {
  const id = `food-${label.toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5">
      <span id={id} className={LABEL}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {[undefined, ...values].map((v) => {
          const on = current === v;
          return (
            <button key={v ?? "any"} type="button" aria-pressed={on} onClick={() => onPick(v)} className={chip(on)}>
              {v !== undefined && dots ? (
                <span aria-hidden="true" className="flex -space-x-1">
                  {dots(v).map((tone) => (
                    <span key={tone} className={`size-3 rounded-full border-2 border-current ${DOT[tone]}`} />
                  ))}
                </span>
              ) : null}
              {v === undefined ? any : name(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FoodIndex({
  places,
  query,
  onChange,
}: Props & { query: FoodQuery; onChange?: (patch: Partial<FoodQuery> | null) => void }) {
  const { resolvedTheme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const mapNear = useNearViewport(slot);
  const set = (patch: Partial<FoodQuery>) => onChange?.(patch);

  const options = useMemo(() => cuisineOptions(places), [places]);
  const shown = useMemo(() => filterPlaces(places, query), [places, query]);
  // A place the filters hide is no longer selected.
  const selected = shown.find((p) => p.id === selectedId) ?? null;
  const empty = shown.length === 0;

  const pickFromList = (id: string) => {
    setSelectedId(id);
    // On a phone the card sits between the map and the list: bring it up.
    requestAnimationFrame(() => {
      const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
      card.current?.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="search"
        aria-label="Filter places"
        className="flex flex-col gap-5 rounded-3xl border-2 border-line bg-surface p-5"
      >
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Cuisine</span>
          <div className="flex flex-wrap items-center gap-2">
            <CuisineDropdown options={options} selected={query.cuisines} onChange={(cuisines) => set({ cuisines })} />
            {query.cuisines.map((c) => (
              <span
                key={c}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-ink bg-soft pr-1 pl-4 font-semibold"
              >
                {c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() => set({ cuisines: query.cuisines.filter((x) => x !== c) })}
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-bg"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                </button>
              </span>
            ))}
            {query.cuisines.length ? (
              <button
                type="button"
                aria-label="Clear cuisines"
                onClick={() => set({ cuisines: [] })}
                className="min-h-11 cursor-pointer px-2 font-bold text-accent-ink underline underline-offset-4"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <ChipGroup<Price>
            label="Price"
            any="Any"
            values={PRICES}
            current={query.price}
            name={priceLabel}
            onPick={(price) => set({ price })}
          />
          <ChipGroup<Region>
            label="Region"
            any="All"
            values={REGIONS}
            current={query.region}
            name={(r) => REGION_LABELS[r]}
            onPick={(region) => set({ region })}
          />
          <ChipGroup<RatingBand>
            label="Rating"
            any="Any"
            values={RATING_BANDS}
            current={query.band}
            name={(b) => RATING_BAND_LABELS[b]}
            dots={bandTones}
            onPick={(band) => set({ band })}
          />
        </div>
      </div>

      <p aria-live="polite" className="font-semibold text-muted">
        {plural(shown.length, "place")}
      </p>

      <div ref={slot} data-testid="food-map-slot" className="relative">
        {mapNear ? (
          <FoodMap
            places={shown}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
          />
        ) : (
          <MapPlaceholder />
        )}
        {empty ? (
          <div className="absolute inset-0.5 z-10 grid place-items-center rounded-[26px] bg-bg/75 p-4">
            <div className="w-full max-w-md rounded-3xl bg-surface">
              <EmptyState
                title="No places match yet."
                onClear={hasFoodFilters(query) ? () => onChange?.(null) : undefined}
              />
            </div>
          </div>
        ) : null}
      </div>

      {empty ? null : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-6 lg:order-2">
            {selected ? (
              <PlaceCard ref={card} place={selected} />
            ) : (
              <p className="rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center font-semibold text-muted">
                Pick a pin or a place to see what I ordered.
              </p>
            )}
          </div>
          <PlaceList places={shown} selectedId={selected?.id ?? null} onSelect={pickFromList} />
        </div>
      )}
    </div>
  );
}

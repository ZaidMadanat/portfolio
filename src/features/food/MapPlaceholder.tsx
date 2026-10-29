// The food map's frame, shared by the real map and its stand-in so the page
// never jumps when MapLibre arrives (spec §6.5: "a static placeholder of the
// same size"). Full content width and large.
export const MAP_BOX =
  "relative h-[min(68vh,640px)] min-h-[360px] w-full overflow-hidden rounded-[28px] border-2 border-ink bg-soft2 shadow-hard";

/** Shown while the MapLibre chunk loads (next/dynamic `loading`), and with JavaScript off. */
export function MapPlaceholder() {
  return (
    <div data-testid="map-placeholder" className={MAP_BOX}>
      {/* A quiet sketch of a bay: land, a shoreline, two streets. Decorative. */}
      <svg aria-hidden="true" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <path d="M0 0h800v500H0z" className="fill-bg" />
        <path
          d="M330 0c-20 70 40 120 20 190s-90 90-70 170 90 90 70 140H0V0z"
          className="fill-soft2"
        />
        <path d="M480 0v500M560 120h240M420 300h380" className="stroke-line" strokeWidth="14" strokeLinecap="round" fill="none" />
      </svg>
      <p className="absolute inset-x-0 bottom-5 text-center text-sm font-semibold text-muted">Loading the map…</p>
    </div>
  );
}

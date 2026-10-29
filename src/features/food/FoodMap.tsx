"use client";

import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./food-map.css";
import { useEffect, useRef, useState } from "react";
import { BAY_AREA_BOUNDS, MAP_ATTRIBUTION, mapStyleFor } from "@/lib/map";
import type { Place } from "@/lib/queries/food";
import { pinTone } from "@/lib/rating";
import { MAP_BOX } from "./MapPlaceholder";

// The food map (spec §6.5). FoodExplorer loads this with next/dynamic
// (ssr: false), so MapLibre is only ever fetched by /reviews/food. Pins are
// HTML buttons over the canvas: they work with a keyboard and a screen
// reader, and they still show when OpenFreeMap's tiles don't load.

// MapLibre finds its worker through import.meta.url, which the bundler
// rewrites to a file path, so point it at the worker file the bundler emits.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

type Props = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  theme: "light" | "dark";
};

const TONE = {
  accent: "bg-accent text-on-accent",
  second: "bg-second text-on-second",
  surface: "bg-surface text-ink",
} as const;

/** Later pins stop waiting after this many steps of the drop-in stagger. */
const MAX_STAGGER = 16;
const FIT_PADDING = { top: 72, bottom: 56, left: 56, right: 56 };

function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function boundsOf(places: Place[]): LngLatBounds | null {
  if (!places.length) return null;
  const b = new LngLatBounds([places[0].lng, places[0].lat], [places[0].lng, places[0].lat]);
  for (const p of places) b.extend([p.lng, p.lat]);
  return b;
}

/** A round pin with a white ring and a pointer tip, showing the rating; the name shows once selected. */
function pinButton(place: Place, index: number, pressed: boolean): HTMLButtonElement {
  const tone = TONE[pinTone(place.rating)];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pin-drop group flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-end";
  button.style.setProperty("--i", String(Math.min(index, MAX_STAGGER)));
  button.setAttribute("aria-label", `${place.name}, ${place.rating} out of 10`);
  button.setAttribute("aria-pressed", String(pressed));

  const body = document.createElement("span");
  body.className = `relative z-10 grid size-9 place-items-center rounded-full border-[3px] border-white font-display text-[15px] leading-none font-extrabold shadow-[0_0_0_1.5px_var(--color-ink),0_3px_0_1.5px_var(--color-ink)] transition-[width,height,font-size] duration-150 group-hover:size-10 group-aria-pressed:size-12 group-aria-pressed:text-lg ${tone}`;
  body.textContent = String(place.rating);

  const tip = document.createElement("span");
  tip.className = `-mt-2 size-3.5 rotate-45 border-r-[3px] border-b-[3px] border-white shadow-[1.5px_1.5px_0_0_var(--color-ink)] ${tone}`;

  const name = document.createElement("span");
  name.className =
    "absolute top-full left-1/2 mt-1.5 hidden max-w-48 -translate-x-1/2 truncate rounded-full border-2 border-ink bg-surface px-3 py-1 text-[13px] font-bold whitespace-nowrap text-ink shadow-[2px_2px_0_var(--color-ink)] group-aria-pressed:block";
  name.textContent = place.name;

  button.append(body, tip, name);
  return button;
}

export function FoodMap({ places, selectedId, onSelect, theme }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pins = useRef(new Map<string, { marker: Marker; button: HTMLButtonElement }>());
  const select = useRef(onSelect);
  const selected = useRef(selectedId);
  const styleTheme = useRef(theme);
  const framed = useRef(false);
  // Client-only component (next/dynamic, ssr: false), so document is there.
  const [failed, setFailed] = useState(() => !hasWebGL());

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  // Create the map once, framed on the Bay Area (and every place, if some are further out).
  useEffect(() => {
    const el = container.current;
    if (!el || failed) return;
    const registry = pins.current;
    const frame = new LngLatBounds([BAY_AREA_BOUNDS[0], BAY_AREA_BOUNDS[1]], [BAY_AREA_BOUNDS[2], BAY_AREA_BOUNDS[3]]);
    const all = boundsOf(places);
    if (all) frame.extend(all);
    let m: MapLibreMap;
    try {
      m = new MapLibreMap({
        container: el,
        style: mapStyleFor(styleTheme.current),
        bounds: frame,
        fitBoundsOptions: { padding: FIT_PADDING },
        attributionControl: false,
        // A big map on a scrolling page: one finger / the wheel scrolls the page.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        minZoom: 6,
        maxZoom: 18,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }), "bottom-right");
    // On a phone the expanded credit covers the bottom of the map: start it
    // folded behind its (i) button, which opens it again.
    if (window.matchMedia("(max-width: 639px)").matches) {
      m.once("load", () => {
        const credit = el.querySelector(".maplibregl-ctrl-attrib");
        credit?.classList.remove("maplibregl-compact-show");
        credit?.removeAttribute("open");
      });
    }
    // Tiles down (OpenFreeMap promises no uptime): keep the pins, list and filters.
    m.on("error", () => {});
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      registry.clear();
    };
    // Created once; later props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  // Pins for exactly the places shown: rebuilt on every filter change, so none go stale.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const registry = pins.current;
    const built = places.map((place, i) => {
      const button = pinButton(place, i, place.id === selected.current);
      button.addEventListener("click", () => select.current(place.id));
      const el = document.createElement("div");
      el.append(button);
      const marker = new Marker({ element: el, anchor: "bottom" }).setLngLat([place.lng, place.lat]).addTo(m);
      if (place.id === selected.current) el.style.zIndex = "2";
      registry.set(place.id, { marker, button });
      return marker;
    });
    // The first set keeps the Bay Area frame; later filters zoom to what's left.
    const b = boundsOf(places);
    if (framed.current && b) m.fitBounds(b, { padding: FIT_PADDING, maxZoom: 14, duration: reducedMotion() ? 0 : 600 });
    framed.current = true;
    return () => {
      for (const marker of built) marker.remove();
      registry.clear();
    };
  }, [places, failed]);

  // Selection: raise and enlarge the pin, then bring it into view.
  useEffect(() => {
    selected.current = selectedId;
    for (const [id, { marker, button }] of pins.current) {
      const on = id === selectedId;
      button.setAttribute("aria-pressed", String(on));
      marker.getElement().style.zIndex = on ? "2" : "";
    }
    const m = map.current;
    const pin = selectedId ? pins.current.get(selectedId) : undefined;
    if (m && pin) {
      m.easeTo({ center: pin.marker.getLngLat(), zoom: Math.max(m.getZoom(), 13), duration: reducedMotion() ? 0 : 500 });
    }
  }, [selectedId]);

  // Dark mode: same sources and layer ids, so the diff only repaints.
  useEffect(() => {
    const m = map.current;
    if (!m || styleTheme.current === theme) return;
    styleTheme.current = theme;
    m.setStyle(mapStyleFor(theme), { diff: true });
  }, [theme]);

  if (failed) {
    return (
      <div data-testid="food-map" className={`${MAP_BOX} grid place-items-center p-6`}>
        <p className="max-w-sm text-center font-semibold text-muted">
          The map can&apos;t load in this browser. Every place is in the list below.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="food-map" className={MAP_BOX}>
      {/* Not absolute: MapLibre gives its container position: relative. */}
      <div ref={container} className="size-full" />
    </div>
  );
}

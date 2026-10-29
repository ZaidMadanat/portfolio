"use client";

import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/styles/map-controls.css";
import { useEffect, useRef, useState } from "react";
import { MAP_STYLE_LIGHT } from "@/lib/map";

// A small MapLibre map with one draggable pin (spec §7 Food): drag the pin, or
// click the map to drop it, and the coordinates update. FoodFields loads this
// with next/dynamic (ssr: false), so MapLibre never reaches a public bundle.
// The Latitude/Longitude inputs beside it are the source of truth and work
// without the map (no WebGL, or the tiles are down).

// MapLibre finds its worker through import.meta.url, which the bundler
// rewrites to a file path, so point it at the worker file the bundler emits.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

/** Roughly the middle of the Bay Area, for a review with no coordinates yet. */
const BAY_AREA = { lng: -122.27, lat: 37.8 };
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** MapLibre needs WebGL 2; without it the inputs are the only way in. */
function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
};

export function PinPicker({ lat, lng, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  // Client-only component (next/dynamic, ssr: false), so document is there.
  const [failed, setFailed] = useState(() => !hasWebGL());

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Create the map once.
  useEffect(() => {
    const el = container.current;
    if (!el || failed) return;
    const start = lat !== null && lng !== null ? { lng, lat } : null;
    let m: MapLibreMap;
    try {
      m = new MapLibreMap({
        container: el,
        style: MAP_STYLE_LIGHT,
        center: start ?? BAY_AREA,
        zoom: start ? 15 : 9,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
    } catch {
      // WebGL there but unusable: show the fallback (after this effect), the inputs still work.
      queueMicrotask(() => setFailed(true));
      return;
    }
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // Tile or style failures shouldn't break the form; the inputs stay usable.
    m.on("error", () => {});

    const pin = document.createElement("div");
    pin.className = "size-7 rounded-full border-[3px] border-ink bg-accent shadow-hard cursor-grab";
    const mk = new Marker({ element: pin, draggable: true, anchor: "center" });
    mk.on("dragend", () => {
      const p = mk.getLngLat();
      pick.current(round(p.lat), round(p.lng));
    });
    if (start) mk.setLngLat(start).addTo(m);
    m.on("click", (e) => {
      mk.setLngLat(e.lngLat).addTo(m);
      pick.current(round(e.lngLat.lat), round(e.lngLat.lng));
    });

    map.current = m;
    marker.current = mk;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; later coordinates move it (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordinates typed in or geocoded: move the pin and the view.
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk || lat === null || lng === null) return;
    const at = mk.getLngLat();
    if (at && round(at.lat) === round(lat) && round(at.lng) === round(lng)) return;
    mk.setLngLat({ lng, lat }).addTo(m);
    m.jumpTo({ center: { lng, lat }, zoom: Math.max(m.getZoom(), 15) });
  }, [lat, lng]);

  if (failed) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-ink bg-bg p-4 text-sm text-muted">
        The map can&apos;t load in this browser. Type the coordinates instead.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={container} className="h-64 w-full overflow-hidden rounded-2xl border-2 border-ink bg-soft2" />
      <p className="text-sm text-muted">Drag the pin, or click the map to drop it there.</p>
    </div>
  );
}


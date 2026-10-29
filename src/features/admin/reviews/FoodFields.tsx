"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { geocodeAction } from "@/app/admin/reviews/actions";
import { applyGeocode, coordinate, regionHint, withCity, type DishRow, type FoodState } from "@/lib/admin/review-form";
import { priceLabel } from "@/lib/format";
import { REGION_LABELS, REGIONS, type Region } from "@/lib/regions";
import { DishList } from "./DishList";
import { describedBy, FIELD, FieldMessages, LABEL, TextField, type FieldErrors } from "./fields";

// The Food tab (spec §7 Food): name, address (geocoded on blur), the pin and
// its coordinates, neighbourhood, city and region (from the city, editable),
// cuisine (base list + "+ New cuisine"), price $–$$$$ and the dishes.

// MapLibre loads only when this tab is open, in the browser.
const PinPicker = dynamic(() => import("./PinPicker").then((m) => m.PinPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl border-2 border-ink bg-soft2 text-sm font-semibold text-muted">
      Loading the map…
    </div>
  ),
});

const NEW_CUISINE = "__new__";
export const GEOCODE_MISS = "Couldn't find that address. Drop the pin on the map instead.";

type Geo = { state: "idle" } | { state: "looking" } | { state: "found"; where: string } | { state: "missed" };

type Props = {
  value: FoodState;
  onChange: (update: (food: FoodState) => FoodState) => void;
  errors: FieldErrors;
  cuisines: string[];
};

export function FoodFields({ value: food, onChange, errors, cuisines }: Props) {
  const [geo, setGeo] = useState<Geo>({ state: "idle" });
  // The address last looked up (or loaded), so a blur without a change doesn't ask again.
  const looked = useRef(food.address.trim());
  const set = <K extends keyof FoodState>(key: K, v: FoodState[K]) => onChange((f) => ({ ...f, [key]: v }));

  async function lookUp() {
    const address = food.address.trim();
    if (address.length < 3 || address === looked.current) return;
    looked.current = address;
    setGeo({ state: "looking" });
    try {
      const hit = await geocodeAction(address);
      if (looked.current !== address) return; // a newer lookup took over
      if (!hit) {
        setGeo({ state: "missed" });
        return;
      }
      onChange((f) => applyGeocode(f, hit));
      setGeo({ state: "found", where: [hit.neighbourhood, hit.city].filter(Boolean).join(", ") });
    } catch {
      // Nominatim unreachable (or the session ended): placing the pin by hand still works.
      if (looked.current === address) setGeo({ state: "missed" });
    }
  }

  const hint = regionHint(food);
  const listed = cuisines.includes(food.cuisine);
  const cuisineSelect = food.customCuisine || (food.cuisine && !listed) ? NEW_CUISINE : food.cuisine;
  const lat = coordinate(food.lat);
  const lng = coordinate(food.lng);

  return (
    <div className="flex flex-col gap-[18px]">
      <TextField id="r-name" label="Name" value={food.title} onValue={(v) => set("title", v)} error={errors.title} autoComplete="off" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-address" className={LABEL}>
          Address
        </label>
        <input
          id="r-address"
          value={food.address}
          onChange={(e) => set("address", e.target.value)}
          onBlur={() => void lookUp()}
          autoComplete="off"
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={describedBy("r-address", errors.address, "geo")}
          className={FIELD}
        />
        <p
          id="r-address-hint"
          role="status"
          data-testid="geocode-status"
          className={`flex min-h-5 items-center gap-2 text-sm ${geo.state === "missed" ? "font-semibold text-accent-ink" : "text-muted"}`}
        >
          {geo.state === "found" ? <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-second" /> : null}
          {geo.state === "looking"
            ? "Looking up the address…"
            : geo.state === "found"
              ? geo.where
                ? `Found · ${geo.where}`
                : "Found on the map."
              : geo.state === "missed"
                ? GEOCODE_MISS
                : null}
        </p>
        <FieldMessages id="r-address" error={errors.address} />
      </div>

      <div className="flex flex-col gap-2">
        <PinPicker lat={lat} lng={lng} onPick={(la, ln) => onChange((f) => ({ ...f, lat: String(la), lng: String(ln) }))} />
        <div className="flex flex-wrap gap-4">
          <TextField
            id="r-lat"
            label="Latitude"
            inputMode="decimal"
            value={food.lat}
            onValue={(v) => set("lat", v)}
            error={errors.lat}
            className="flex-[1_1_9rem]"
          />
          <TextField
            id="r-lng"
            label="Longitude"
            inputMode="decimal"
            value={food.lng}
            onValue={(v) => set("lng", v)}
            error={errors.lat ? undefined : errors.lng}
            className="flex-[1_1_9rem]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <TextField
          id="r-neighbourhood"
          label="Neighbourhood"
          value={food.neighbourhood}
          onValue={(v) => set("neighbourhood", v)}
          error={errors.neighbourhood}
          className="flex-[1_1_12rem]"
        />
        <TextField
          id="r-city"
          label="City"
          value={food.city}
          onValue={(v) => onChange((f) => withCity(f, v))}
          error={errors.city}
          className="flex-[1_1_12rem]"
        />
        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
          <label htmlFor="r-region" className={LABEL}>
            Region
          </label>
          <select
            id="r-region"
            value={food.region}
            onChange={(e) => onChange((f) => ({ ...f, region: e.target.value as Region | "", regionTouched: e.target.value !== "" }))}
            aria-invalid={errors.region ? true : undefined}
            aria-describedby={describedBy("r-region", errors.region, hint)}
            className={FIELD}
          >
            <option value="">Pick a region</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r]}
              </option>
            ))}
          </select>
          <FieldMessages id="r-region" error={errors.region} hint={errors.region ? null : hint} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
          <label htmlFor="r-cuisine" className={LABEL}>
            Cuisine
          </label>
          <select
            id="r-cuisine"
            value={cuisineSelect}
            onChange={(e) => {
              const v = e.target.value;
              onChange((f) => (v === NEW_CUISINE ? { ...f, cuisine: "", customCuisine: true } : { ...f, cuisine: v, customCuisine: false }));
            }}
            aria-invalid={errors.cuisine && cuisineSelect !== NEW_CUISINE ? true : undefined}
            aria-describedby={cuisineSelect === NEW_CUISINE ? undefined : describedBy("r-cuisine", errors.cuisine)}
            className={FIELD}
          >
            <option value="">Pick a cuisine</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CUISINE}>+ New cuisine</option>
          </select>
          {cuisineSelect === NEW_CUISINE ? null : <FieldMessages id="r-cuisine" error={errors.cuisine} />}
          {cuisineSelect === NEW_CUISINE ? (
            <TextField id="r-new-cuisine" label="New cuisine" value={food.cuisine} onValue={(v) => set("cuisine", v)} error={errors.cuisine} autoFocus />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
          <span id="r-price-label" className={LABEL}>
            Price
          </span>
          <div role="group" aria-labelledby="r-price-label" aria-describedby={describedBy("r-price", errors.price)} className="flex gap-1.5">
            {[1, 2, 3, 4].map((p) => {
              const on = food.price === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("price", p)}
                  className={`min-h-11 flex-1 cursor-pointer rounded-xl border-2 border-ink font-extrabold ${on ? "bg-ink text-bg" : "bg-bg text-ink hover:bg-soft"}`}
                >
                  {priceLabel(p)}
                </button>
              );
            })}
          </div>
          <FieldMessages id="r-price" error={errors.price} />
        </div>
      </div>

      <DishList dishes={food.dishes} onChange={(update: (ds: DishRow[]) => DishRow[]) => onChange((f) => ({ ...f, dishes: update(f.dishes) }))} error={errors.dishes} />
    </div>
  );
}

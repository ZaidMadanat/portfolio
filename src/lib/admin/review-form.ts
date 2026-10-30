import type { ReviewKind } from "@/generated/prisma/enums";
import { formatMonthDay } from "@/lib/format";
import type { GeocodeResult } from "@/lib/geocode";
import { cityToRegion, type Region } from "@/lib/regions";
import { foodMeta, REVIEW_KIND_LABEL } from "@/lib/reviews/meta";

// The admin review form's state (spec §7 Reviews), kept as plain strings the
// inputs show, plus the pure rules around it. Browser-safe. Each kind keeps its
// own fields, so switching tabs never loses them; rating, date, photos and the
// linked post are shared by every kind.

export const REVIEW_KINDS = ["FOOD", "FILM", "ALBUM", "CONCERT"] as const satisfies readonly ReviewKind[];

export type DishRow = { key: string; name: string; mustOrder: boolean };
export type PhotoRow = { id: string; url: string };

export type SharedState = { rating: number | null; date: string; photos: PhotoRow[]; postId: string | null };

export type FoodState = {
  title: string;
  address: string;
  lat: string;
  lng: string;
  neighbourhood: string;
  city: string;
  region: Region | "";
  /** Set once the region is picked by hand; the city then stops changing it. */
  regionTouched: boolean;
  cuisine: string;
  /** Typing a cuisine that isn't on the list ("+ New cuisine"). */
  customCuisine: boolean;
  price: number | null;
  dishes: DishRow[];
};

/** `filmLogId` "" = a film entered by hand. */
export type FilmState = { filmLogId: string; title: string; year: string };
/** `listenId` "" = entered by hand. */
export type AlbumState = { listenId: string; title: string; artist: string; year: string; coverUrl: string; statsfmAlbumId: string };
export type ConcertState = { artist: string; venue: string; highlight: string };

export type ReviewFormState = {
  kind: ReviewKind;
  shared: SharedState;
  food: FoodState;
  film: FilmState;
  album: AlbumState;
  concert: ConcertState;
};

/** A synced Letterboxd log the Film tab can pick. `rating` is starsToTen(stars). */
export type FilmLogOption = {
  id: string;
  title: string;
  year: number;
  rating: number | null;
  /** `YYYY-MM-DD`. */
  watchedAt: string;
  label: string;
  /** Another review already uses this log. */
  reviewed: boolean;
};

/** A row from the current stats.fm window. */
export type AlbumOption = { id: string; title: string; artist: string; year: number | null; coverUrl: string; statsfmAlbumId: string };

export const REGION_HINT = "This city isn't on the region list, so pick the closest one.";

// ---------------------------------------------------------------- defaults

export const emptyFood = (): FoodState => ({
  title: "",
  address: "",
  lat: "",
  lng: "",
  neighbourhood: "",
  city: "",
  region: "",
  regionTouched: false,
  cuisine: "",
  customCuisine: false,
  price: null,
  dishes: [{ key: "k1", name: "", mustOrder: true }],
});
export const emptyFilm = (): FilmState => ({ filmLogId: "", title: "", year: "" });
export const emptyAlbum = (): AlbumState => ({ listenId: "", title: "", artist: "", year: "", coverUrl: "", statsfmAlbumId: "" });
export const emptyConcert = (): ConcertState => ({ artist: "", venue: "", highlight: "" });

/** A blank form on `kind`'s tab, dated `today` (`YYYY-MM-DD`). */
export function emptyReviewForm(kind: ReviewKind, today: string): ReviewFormState {
  return {
    kind,
    shared: { rating: null, date: today, photos: [], postId: null },
    food: emptyFood(),
    film: emptyFilm(),
    album: emptyAlbum(),
    concert: emptyConcert(),
  };
}

// ---------------------------------------------------------------- dishes

const keyNumber = (key: string) => Number(key.slice(1)) || 0;

/** Adds an empty dish. It's the must-order only when no other dish is. */
export function addDish(dishes: DishRow[]): DishRow[] {
  const next = dishes.reduce((max, d) => Math.max(max, keyNumber(d.key)), 0) + 1;
  return [...dishes, { key: `k${next}`, name: "", mustOrder: !dishes.some((d) => d.mustOrder) }];
}

/** Removes a dish; if it was the must-order, the first one left takes over. */
export function removeDish(dishes: DishRow[], key: string): DishRow[] {
  const rest = dishes.filter((d) => d.key !== key);
  if (rest.length > 0 && !rest.some((d) => d.mustOrder)) rest[0] = { ...rest[0], mustOrder: true };
  return rest;
}

/** Exactly one must-order dish. */
export function markMustOrder(dishes: DishRow[], key: string): DishRow[] {
  return dishes.map((d) => ({ ...d, mustOrder: d.key === key }));
}

export function renameDish(dishes: DishRow[], key: string, name: string): DishRow[] {
  return dishes.map((d) => (d.key === key ? { ...d, name } : d));
}

// ---------------------------------------------------------------- food

/** Sets the city; the region follows it (null → blank) unless it was picked by hand. */
export function withCity(food: FoodState, city: string): FoodState {
  return { ...food, city, region: food.regionTouched ? food.region : (cityToRegion(city) ?? "") };
}

/** Shown under Region when the city isn't on the list and no region is picked yet. */
export function regionHint(food: FoodState): string | null {
  return food.city.trim() && !food.region && cityToRegion(food.city) === null ? REGION_HINT : null;
}

/** A geocoder hit: the coordinates, plus its neighbourhood and city when it has them. */
export function applyGeocode(food: FoodState, hit: GeocodeResult): FoodState {
  const next = { ...food, lat: String(hit.lat), lng: String(hit.lng), neighbourhood: hit.neighbourhood ?? food.neighbourhood };
  return hit.city ? withCity(next, hit.city) : next;
}

/** A coordinate typed or dragged in, as a number, or null when it isn't one. */
export function coordinate(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------- picks

/** Picks a film log (title, year and its rating, when it has one), or null for a film typed in. */
export function pickFilmLog(state: ReviewFormState, log: FilmLogOption | null): ReviewFormState {
  if (!log) return { ...state, film: { ...state.film, filmLogId: "" } };
  return {
    ...state,
    film: { filmLogId: log.id, title: log.title, year: String(log.year) },
    shared: { ...state.shared, rating: log.rating ?? state.shared.rating },
  };
}

/** Picks an album from the stats.fm window, or null to type one in. */
export function pickAlbum(album: AlbumState, listen: AlbumOption | null): AlbumState {
  if (!listen) return { ...album, listenId: "", statsfmAlbumId: "" };
  return {
    listenId: listen.id,
    title: listen.title,
    artist: listen.artist,
    year: listen.year ? String(listen.year) : "",
    coverUrl: listen.coverUrl,
    statsfmAlbumId: listen.statsfmAlbumId,
  };
}

// ---------------------------------------------------------------- the draft

const text = (v: string) => (v.trim() === "" ? undefined : v);
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/**
 * What the form sends to saveReview, before validation: blanks are left out
 * so `reviewInput` names each missing field. Only the current kind's fields
 * are sent.
 */
export function toReviewDraft(state: ReviewFormState): Record<string, unknown> {
  const { shared } = state;
  const base = {
    kind: state.kind,
    rating: shared.rating ?? undefined,
    date: shared.date,
    photos: shared.photos.map((p) => p.id),
    postId: shared.postId,
  };
  const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  switch (state.kind) {
    case "FOOD": {
      const f = state.food;
      return strip({
        ...base,
        title: text(f.title),
        address: text(f.address),
        lat: num(f.lat),
        lng: num(f.lng),
        cuisine: text(f.cuisine),
        price: f.price ?? undefined,
        neighbourhood: text(f.neighbourhood),
        city: text(f.city),
        region: f.region || undefined,
        dishes: f.dishes.map(({ name, mustOrder }) => ({ name, mustOrder })),
      });
    }
    case "FILM": {
      const f = state.film;
      return strip({
        ...base,
        title: text(f.title),
        filmLogId: f.filmLogId || null,
        year: f.filmLogId ? undefined : num(f.year),
      });
    }
    case "ALBUM": {
      const a = state.album;
      return strip({
        ...base,
        title: text(a.title),
        artist: text(a.artist),
        year: num(a.year),
        coverUrl: text(a.coverUrl),
        statsfmAlbumId: text(a.statsfmAlbumId),
      });
    }
    case "CONCERT": {
      const c = state.concert;
      return strip({ ...base, artist: text(c.artist), venue: text(c.venue), highlight: text(c.highlight) });
    }
  }
}

// ---------------------------------------------------------------- preview

export type ReviewPreview = { kind: string; title: string; meta: string; rating: number | null; photoUrl: string | null };

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const dayLabel = (v: string) => (isDate(v) ? formatMonthDay(`${v}T00:00:00.000Z`) : "");

/** The live preview card's contents, as the public pages will show them. */
export function previewOf(state: ReviewFormState, filmLogs: FilmLogOption[]): ReviewPreview {
  const { shared } = state;
  const common = { kind: REVIEW_KIND_LABEL[state.kind], rating: shared.rating, photoUrl: shared.photos[0]?.url ?? null };
  const titled = (t: string) => t.trim() || "Untitled";
  switch (state.kind) {
    case "FOOD": {
      const f = state.food;
      return {
        ...common,
        title: titled(f.title),
        meta: foodMeta({ cuisine: f.cuisine.trim() || null, price: f.price, neighbourhood: f.neighbourhood.trim() || null, city: f.city.trim() || null }),
      };
    }
    case "FILM": {
      const f = state.film;
      const log = filmLogs.find((l) => l.id === f.filmLogId);
      const year = f.year.trim();
      const watched = dayLabel(log?.watchedAt ?? shared.date);
      return { ...common, title: `${titled(f.title)}${year ? ` (${year})` : ""}`, meta: watched ? `Watched ${watched}` : "" };
    }
    case "ALBUM": {
      const a = state.album;
      return { ...common, title: titled(a.title), meta: [a.artist.trim(), a.year.trim()].filter(Boolean).join(" · ") };
    }
    case "CONCERT": {
      const c = state.concert;
      return { ...common, title: titled(c.artist), meta: [c.venue.trim(), dayLabel(shared.date)].filter(Boolean).join(" · ") };
    }
  }
}

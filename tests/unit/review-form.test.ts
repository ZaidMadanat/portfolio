import { describe, expect, it } from "vitest";
import {
  addDish,
  applyGeocode,
  emptyReviewForm,
  markMustOrder,
  pickAlbum,
  pickFilmLog,
  previewOf,
  regionHint,
  removeDish,
  toReviewDraft,
  withCity,
  type ReviewFormState,
} from "@/lib/admin/review-form";
import { reviewInput } from "@/lib/reviews/schema";

// The review form's pure state helpers (spec §7 Reviews): dish list rules,
// region auto-fill, geocode results, film/album picks, the draft sent to
// saveReview and the live preview.

const form = (kind: ReviewFormState["kind"] = "FOOD") => emptyReviewForm(kind, "2026-10-29");

describe("dishes", () => {
  it("starts with one empty must-order dish", () => {
    expect(form().food.dishes).toEqual([{ key: "k1", name: "", mustOrder: true }]);
  });

  it("adds dishes that aren't must-order while one is", () => {
    const ds = addDish(addDish(form().food.dishes));
    expect(ds.map((d) => [d.key, d.mustOrder])).toEqual([
      ["k1", true],
      ["k2", false],
      ["k3", false],
    ]);
  });

  it("keeps exactly one must-order when marking and removing", () => {
    let ds = addDish(addDish(form().food.dishes));
    ds = markMustOrder(ds, "k2");
    expect(ds.filter((d) => d.mustOrder).map((d) => d.key)).toEqual(["k2"]);
    ds = removeDish(ds, "k2");
    expect(ds.filter((d) => d.mustOrder).map((d) => d.key)).toEqual(["k1"]);
    ds = removeDish(ds, "k3");
    expect(ds).toEqual([{ key: "k1", name: "", mustOrder: true }]);
    // Never reuses a key that's still on screen.
    expect(addDish(markMustOrder(addDish(ds), "k1")).map((d) => d.key)).toEqual(["k1", "k2", "k3"]);
  });

  it("an emptied list gets a must-order dish again when one is added", () => {
    expect(addDish(removeDish(form().food.dishes, "k1"))).toEqual([{ key: "k1", name: "", mustOrder: true }]);
  });
});

describe("region", () => {
  it("auto-fills from a known city, case-insensitively", () => {
    expect(withCity(form().food, " berkeley ").region).toBe("EAST_BAY");
  });

  it("clears for an unknown city and hints that one must be picked", () => {
    const food = withCity(withCity(form().food, "Berkeley"), "Pacifica");
    expect(food.region).toBe("");
    expect(regionHint(food)).toBe("This city isn't on the region list, so pick the closest one.");
    expect(regionHint(withCity(form().food, "Oakland"))).toBeNull();
    expect(regionHint(form().food)).toBeNull();
  });

  it("keeps a region picked by hand when the city changes", () => {
    const food = { ...withCity(form().food, "Pacifica"), region: "PENINSULA" as const, regionTouched: true };
    expect(withCity(food, "San Francisco").region).toBe("PENINSULA");
    expect(regionHint(food)).toBeNull();
  });
});

describe("applyGeocode", () => {
  it("fills the coordinates, neighbourhood, city and region", () => {
    const food = applyGeocode(form().food, { lat: 37.783, lng: -122.463, neighbourhood: "Inner Richmond", city: "San Francisco" });
    expect(food).toMatchObject({ lat: "37.783", lng: "-122.463", neighbourhood: "Inner Richmond", city: "San Francisco", region: "SAN_FRANCISCO" });
  });

  it("keeps what's there when the result has no neighbourhood or city", () => {
    const start = { ...withCity(form().food, "Oakland"), neighbourhood: "Temescal" };
    expect(applyGeocode(start, { lat: 1, lng: 2 })).toMatchObject({ lat: "1", lng: "2", neighbourhood: "Temescal", city: "Oakland", region: "EAST_BAY" });
  });
});

describe("picks", () => {
  const log = { id: "log1", title: "The Aviator", year: 2004, rating: 9, watchedAt: "2026-04-24", label: "", reviewed: false };

  it("a film log sets the title and prefills the rating from its stars", () => {
    const s = pickFilmLog(form("FILM"), log);
    expect(s.film).toEqual({ filmLogId: "log1", title: "The Aviator", year: "2004" });
    expect(s.shared.rating).toBe(9);
  });

  it("an unrated log keeps the rating already picked; manual entry keeps the title", () => {
    const rated = { ...form("FILM"), shared: { ...form("FILM").shared, rating: 6 } };
    expect(pickFilmLog(rated, { ...log, rating: null }).shared.rating).toBe(6);
    const manual = pickFilmLog(pickFilmLog(form("FILM"), log), null);
    expect(manual.film).toEqual({ filmLogId: "", title: "The Aviator", year: "2004" });
  });

  it("an album listen fills the fields and its stats.fm id; manual entry drops the id", () => {
    const listen = { id: "l1", title: "Blonde", artist: "Frank Ocean", year: 2016, coverUrl: "", statsfmAlbumId: "s1" };
    const album = pickAlbum(form("ALBUM").album, listen);
    expect(album).toEqual({ listenId: "l1", title: "Blonde", artist: "Frank Ocean", year: "2016", coverUrl: "", statsfmAlbumId: "s1" });
    expect(pickAlbum(album, null)).toEqual({ ...album, listenId: "", statsfmAlbumId: "" });
  });
});

describe("toReviewDraft", () => {
  it("builds a FOOD input that passes validation", () => {
    let s = form();
    s = {
      ...s,
      shared: { ...s.shared, rating: 8, photos: [{ id: "m1", url: "/x.webp" }], postId: null },
      food: {
        ...applyGeocode({ ...s.food, title: "Burma Superstar", address: "309 Clement St, San Francisco" }, {
          lat: 37.783,
          lng: -122.463,
          neighbourhood: "Inner Richmond",
          city: "San Francisco",
        }),
        cuisine: "Burmese",
        price: 2,
        dishes: [
          { key: "k1", name: "Tea leaf salad", mustOrder: true },
          { key: "k2", name: "Samusa soup", mustOrder: false },
        ],
      },
    };
    const draft = toReviewDraft(s);
    expect(draft).toEqual({
      kind: "FOOD",
      rating: 8,
      date: "2026-10-29",
      photos: ["m1"],
      postId: null,
      title: "Burma Superstar",
      address: "309 Clement St, San Francisco",
      lat: 37.783,
      lng: -122.463,
      cuisine: "Burmese",
      price: 2,
      neighbourhood: "Inner Richmond",
      city: "San Francisco",
      region: "SAN_FRANCISCO",
      dishes: [
        { name: "Tea leaf salad", mustOrder: true },
        { name: "Samusa soup", mustOrder: false },
      ],
    });
    expect(reviewInput.safeParse(draft).success).toBe(true);
  });

  it("leaves blanks out, so validation names the missing fields", () => {
    const result = reviewInput.safeParse(toReviewDraft(form()));
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["rating", "title", "address", "lat", "lng", "cuisine", "price", "city", "region", "dishes"]));
  });

  it("FILM: a linked log sends its id and no year; a manual film sends its year", () => {
    const linked = pickFilmLog(form("FILM"), { id: "log1", title: "Yojimbo", year: 1961, rating: null, watchedAt: "2026-04-26", label: "", reviewed: false });
    expect(toReviewDraft(linked)).toMatchObject({ kind: "FILM", title: "Yojimbo", filmLogId: "log1" });
    expect(toReviewDraft(linked)).not.toHaveProperty("year");
    const manual = { ...form("FILM"), film: { filmLogId: "", title: "Paris, Texas", year: "1984" } };
    expect(toReviewDraft(manual)).toMatchObject({ kind: "FILM", title: "Paris, Texas", filmLogId: null, year: 1984 });
  });

  it("ALBUM and CONCERT send their own fields only", () => {
    const album = { ...form("ALBUM"), album: { listenId: "", title: "GNX", artist: "Kendrick Lamar", year: "", coverUrl: " ", statsfmAlbumId: "" } };
    expect(toReviewDraft(album)).toEqual({ kind: "ALBUM", rating: undefined, date: "2026-10-29", photos: [], postId: null, title: "GNX", artist: "Kendrick Lamar" });
    const concert = { ...form("CONCERT"), concert: { artist: "Khruangbin", venue: "Greek Theatre", highlight: "" } };
    expect(toReviewDraft(concert)).toEqual({ kind: "CONCERT", rating: undefined, date: "2026-10-29", photos: [], postId: null, artist: "Khruangbin", venue: "Greek Theatre" });
  });
});

describe("previewOf", () => {
  it("shows each kind's title and meta", () => {
    const food = { ...form(), food: { ...form().food, title: "Comal", cuisine: "Mexican", price: 2, neighbourhood: "Downtown", city: "Berkeley" } };
    expect(previewOf(food, [])).toMatchObject({ kind: "Food", title: "Comal", meta: "Mexican · $$ · Downtown, Berkeley", rating: null });

    const logs = [{ id: "log1", title: "Yojimbo", year: 1961, rating: null, watchedAt: "2026-04-26", label: "", reviewed: false }];
    expect(previewOf(pickFilmLog(form("FILM"), logs[0]), logs)).toMatchObject({ kind: "Film", title: "Yojimbo (1961)", meta: "Watched Apr 26" });

    const album = { ...form("ALBUM"), album: { ...form("ALBUM").album, title: "Blonde", artist: "Frank Ocean", year: "2016" } };
    expect(previewOf(album, [])).toMatchObject({ kind: "Album", title: "Blonde", meta: "Frank Ocean · 2016" });

    const concert = { ...form("CONCERT"), concert: { artist: "Khruangbin", venue: "Greek Theatre", highlight: "" } };
    expect(previewOf(concert, [])).toMatchObject({ kind: "Concert", title: "Khruangbin", meta: "Greek Theatre · Oct 29" });
  });

  it("uses the first photo and falls back to a placeholder title", () => {
    const s = { ...form(), shared: { ...form().shared, rating: 7, photos: [{ id: "a", url: "/a.webp" }, { id: "b", url: "/b.webp" }] } };
    expect(previewOf(s, [])).toMatchObject({ title: "Untitled", meta: "", rating: 7, photoUrl: "/a.webp" });
  });
});

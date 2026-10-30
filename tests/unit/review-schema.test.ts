import { describe, expect, it } from "vitest";
import { REGION_REQUIRED_MESSAGE, reviewInput } from "@/lib/reviews/schema";

// The admin review form's validation (spec §7 Reviews, §8).

const food = (extra: Record<string, unknown> = {}) => ({
  kind: "FOOD",
  title: "Burma Superstar",
  rating: 8,
  date: "2026-10-12",
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
  ...extra,
});

const film = (extra: Record<string, unknown> = {}) => ({ kind: "FILM", title: "Ben-Hur", rating: 10, date: "2026-04-26", ...extra });

const messages = (input: unknown) => {
  const r = reviewInput.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("reviewInput", () => {
  it("accepts a full FOOD review and turns the date into a UTC calendar date", () => {
    const r = reviewInput.parse(food());
    expect(r.kind).toBe("FOOD");
    expect(r.date.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("rejects a FOOD review with two must-order dishes, or none", () => {
    expect(
      messages(
        food({
          dishes: [
            { name: "Tea leaf salad", mustOrder: true },
            { name: "Samusa soup", mustOrder: true },
          ],
        }),
      ),
    ).toEqual(["dishes: Pick exactly one must-order dish."]);
    expect(messages(food({ dishes: [{ name: "Tea leaf salad", mustOrder: false }] }))).toEqual([
      "dishes: Pick exactly one must-order dish.",
    ]);
  });

  it("needs at least one dish", () => {
    expect(messages(food({ dishes: [] }))).toEqual(["dishes: Add at least one dish."]);
  });

  it("rating: 0 and 11 and 7.5 fail, 1 and 10 pass", () => {
    expect(messages(food({ rating: 0 }))).toHaveLength(1);
    expect(messages(food({ rating: 11 }))).toHaveLength(1);
    expect(messages(food({ rating: 7.5 }))).toHaveLength(1);
    expect(reviewInput.safeParse(food({ rating: 1 })).success).toBe(true);
    expect(reviewInput.safeParse(food({ rating: 10 })).success).toBe(true);
    expect(reviewInput.safeParse(film({ rating: 10 })).success).toBe(true);
  });

  it("price is 1-4", () => {
    expect(messages(food({ price: 0 }))).toHaveLength(1);
    expect(messages(food({ price: 5 }))).toHaveLength(1);
    expect(reviewInput.safeParse(food({ price: 4 })).success).toBe(true);
  });

  it("requires a region, and says to pick one when the city isn't mapped", () => {
    expect(messages(food({ region: undefined, city: "Pacifica" }))).toEqual([`region: ${REGION_REQUIRED_MESSAGE}`]);
    expect(messages(food({ region: "OTHER" }))).toEqual([`region: ${REGION_REQUIRED_MESSAGE}`]);
    expect(REGION_REQUIRED_MESSAGE).toMatch(/pick a region/i);
  });

  it("FOOD needs a name, address, coordinates, cuisine and city; the neighbourhood is optional", () => {
    expect(messages(food({ title: "  " }))).toEqual(["title: Add a name."]);
    expect(messages(food({ lat: undefined, lng: undefined }))).toHaveLength(2);
    expect(messages(food({ cuisine: "" }))).toHaveLength(1);
    expect(reviewInput.safeParse(food({ neighbourhood: undefined })).success).toBe(true);
  });

  it("a FILM review with no filmLogId passes (manual film)", () => {
    const r = reviewInput.parse(film());
    expect(r).toMatchObject({ kind: "FILM", title: "Ben-Hur" });
    expect(reviewInput.safeParse(film({ filmLogId: "dev-fixture-log-1" })).success).toBe(true);
  });

  it("ALBUM needs title and artist; year and cover are optional", () => {
    const album = { kind: "ALBUM", title: "In Rainbows", artist: "Radiohead", rating: 9, date: "2026-10-01" };
    expect(reviewInput.safeParse(album).success).toBe(true);
    expect(reviewInput.safeParse({ ...album, year: 2007, coverUrl: "https://i.scdn.co/image/abc" }).success).toBe(true);
    expect(messages({ ...album, artist: "" })).toEqual(["artist: Add the artist."]);
    expect(messages({ ...album, title: "" })).toEqual(["title: Add a title."]);
    expect(messages({ ...album, coverUrl: "javascript:alert(1)" })).toHaveLength(1);
  });

  it("CONCERT needs artist and venue; the highlight is optional", () => {
    const concert = { kind: "CONCERT", artist: "Radiohead", venue: "Greek Theatre", rating: 9, date: "2026-09-20" };
    expect(reviewInput.safeParse(concert).success).toBe(true);
    expect(reviewInput.safeParse({ ...concert, highlight: "Everything In Its Right Place" }).success).toBe(true);
    expect(messages({ ...concert, venue: "" })).toEqual(["venue: Add the venue."]);
    expect(messages({ ...concert, artist: undefined })).toHaveLength(1);
  });

  it("rejects an unknown kind and a bad date", () => {
    expect(reviewInput.safeParse({ ...film(), kind: "BOOK" }).success).toBe(false);
    expect(messages(film({ date: "2026-13-40" }))).toHaveLength(1);
  });

  it("photos are unique media ids, in order", () => {
    expect(reviewInput.parse(film({ photos: ["m2", "m1"] })).photos).toEqual(["m2", "m1"]);
    expect(messages(film({ photos: ["m1", "m1"] }))).toHaveLength(1);
  });
});

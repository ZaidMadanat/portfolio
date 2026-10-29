import { z } from "zod";
import { REGIONS } from "@/lib/regions";

// Validation for the admin review form (spec §7 Reviews, §8). Browser-safe
// (zod + the static region list), so the form can check input before it sends
// it and the server action re-checks the same rules.

/** Shown when the region is missing: `cityToRegion` returned null, so the form must pick one. */
export const REGION_REQUIRED_MESSAGE = "Pick a region. This city isn't on the region list, so choose the closest one.";

const id = z.string().trim().min(1).max(64);

const text = (max: number, required: string) => z.string({ error: required }).trim().min(1, { error: required }).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const isCoverUrl = (v: string) => /^https:\/\/\S+$/i.test(v) || /^\/(?!\/)\S*$/.test(v);

const base = {
  rating: z
    .number({ error: "Pick a rating from 1 to 10." })
    .int({ error: "Pick a rating from 1 to 10." })
    .min(1, { error: "Pick a rating from 1 to 10." })
    .max(10, { error: "Pick a rating from 1 to 10." }),
  /** A calendar date, `YYYY-MM-DD`, stored as UTC midnight (shown in UTC, like the seeds). */
  date: z.iso.date({ error: "Pick a date." }).transform((d) => new Date(`${d}T00:00:00.000Z`)),
  /** Media ids, in display order. */
  photos: z
    .array(id)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, { error: "A photo is listed twice." })
    .default([]),
  /** A post to link (its rating box). Leave out to keep the current link; null removes it. */
  postId: id.nullable().optional(),
};

const dish = z.object({ name: text(100, "Name the dish."), mustOrder: z.boolean().default(false) });

const food = z.object({
  kind: z.literal("FOOD"),
  ...base,
  title: text(200, "Add a name."),
  address: text(300, "Add the address."),
  lat: z.number({ error: "Find the address or place the pin." }).min(-90).max(90),
  lng: z.number({ error: "Find the address or place the pin." }).min(-180).max(180),
  cuisine: text(60, "Pick a cuisine."),
  price: z.number({ error: "Pick a price." }).int().min(1, { error: "Pick a price." }).max(4, { error: "Pick a price." }),
  neighbourhood: optionalText(100),
  city: text(100, "Add the city."),
  region: z.enum(REGIONS, { error: REGION_REQUIRED_MESSAGE }),
  dishes: z
    .array(dish)
    .min(1, { error: "Add at least one dish." })
    .max(30)
    .refine((ds) => ds.length === 0 || ds.filter((d) => d.mustOrder).length === 1, {
      error: "Pick exactly one must-order dish.",
    }),
});

const film = z.object({
  kind: z.literal("FILM"),
  ...base,
  title: text(200, "Add a title."),
  /** A synced Letterboxd log. Omitted for a film entered by hand. */
  filmLogId: id.nullable().optional(),
  /** For a film entered by hand; a linked log has its own year. */
  year: z.number().int().min(1870).max(2100).optional(),
});

const album = z.object({
  kind: z.literal("ALBUM"),
  ...base,
  title: text(200, "Add a title."),
  artist: text(200, "Add the artist."),
  year: z.number().int().min(1900).max(2100).optional(),
  coverUrl: optionalText(2000).refine((v) => v === undefined || isCoverUrl(v), { error: "Use an https:// image link." }),
  statsfmAlbumId: optionalText(64),
});

const concert = z.object({
  kind: z.literal("CONCERT"),
  ...base,
  /** Optional: a concert without one is named after the artist. */
  title: optionalText(200),
  artist: text(200, "Add the artist."),
  venue: text(200, "Add the venue."),
  highlight: optionalText(500),
});

export const reviewInput = z.discriminatedUnion("kind", [food, film, album, concert]);

/** What the form sends. */
export type ReviewInput = z.input<typeof reviewInput>;
/** After validation: trimmed, dates parsed, optional blanks dropped. */
export type ParsedReview = z.output<typeof reviewInput>;

/** The first message per field, keyed by its top-level name (`dishes`, `region`…), for the form. */
export function reviewFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

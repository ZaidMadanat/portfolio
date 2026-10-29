// `npm run db:seed` (prisma db seed): always upserts the 7 built-in templates.
// `SEED_FIXTURES=1 npm run db:seed` also adds DEV-ONLY SAMPLE DATA: 12 film logs
// (Zaid's real April 2026 Letterboxd diary), 8 sample food places, a FILM review,
// 8 sample posts, top-4 film and album favourites and a sample stats.fm window.
// Fixture ids start with "dev-fixture-" and fixtures refuse to run against a
// non-local database. Re-running either mode is idempotent.

import { pathToFileURL } from "node:url";
import type { Category, Prisma, PrismaClient, Region } from "../src/generated/prisma/client";
import type { PartialPostBlock } from "../src/lib/blocks/schema";
import { plainText, renderPostHtml } from "../src/lib/blocks/render";
import { getDb } from "../src/lib/db";
import { starsToTen } from "../src/lib/rating";
import { readingMinutes } from "../src/lib/reading-time";

// ---------------------------------------------------------------- block helpers

const h2 = (text: string): PartialPostBlock => ({ type: "heading", props: { level: 2 }, content: text });
const p = (text = ""): PartialPostBlock => ({ type: "paragraph", content: text });
const bullet = (text: string): PartialPostBlock => ({ type: "bulletListItem", content: text });
const quote = (text: string): PartialPostBlock => ({ type: "quote", content: text });
const math = (latex: string): PartialPostBlock => ({ type: "math", props: { latex } });
const code = (language: string, text: string): PartialPostBlock => ({
  type: "codeBlock",
  props: { language },
  content: text,
});
const callout = (text: string, variant: "tip" | "warning" = "tip"): PartialPostBlock => ({
  type: "callout",
  props: { variant },
  content: text,
});

/** A heading skeleton: each heading followed by an empty paragraph to type into. */
const skeleton = (...headings: string[]): PartialPostBlock[] => headings.flatMap((h) => [h2(h), p()]);

const asJson = (blocks: PartialPostBlock[]) => blocks as unknown as Prisma.InputJsonValue;

// ---------------------------------------------------------------- built-in templates

export const BUILT_IN_TEMPLATES: { id: string; name: string; category: Category; blocks: PartialPostBlock[] }[] = [
  {
    id: "builtin-essay",
    name: "Essay",
    category: "PHILOSOPHY",
    blocks: skeleton("The question", "The argument", "Objections", "Where I land"),
  },
  {
    id: "builtin-notes",
    name: "Notes / cheat sheet",
    category: "NOTES",
    blocks: skeleton("Summary", "Key ideas", "Formulas", "Gotchas", "Sources"),
  },
  {
    id: "builtin-project",
    name: "Project write-up",
    category: "PROJECTS",
    blocks: skeleton("What it is", "Why I built it", "How it works", "What I learned", "Links"),
  },
  {
    id: "builtin-restaurant",
    name: "Restaurant review",
    category: "FOOD",
    blocks: skeleton("The place", "What I ordered", "The verdict"),
  },
  {
    id: "builtin-film",
    name: "Film review",
    category: "FILM",
    blocks: skeleton("First impressions", "What worked", "What didn't", "The verdict"),
  },
  {
    id: "builtin-album",
    name: "Album review",
    category: "MUSIC",
    blocks: skeleton("The sound", "Standout tracks", "The verdict"),
  },
  {
    id: "builtin-concert",
    name: "Concert review",
    category: "MUSIC",
    blocks: skeleton("The venue", "The set", "The highlight", "The verdict"),
  },
];

async function seedTemplates(db: PrismaClient) {
  for (const t of BUILT_IN_TEMPLATES) {
    const data = { name: t.name, builtIn: true, category: t.category, blocks: asJson(t.blocks) };
    await db.template.upsert({ where: { id: t.id }, create: { id: t.id, ...data }, update: data });
  }
}

// ---------------------------------------------------------------- DEV-ONLY fixtures

const LB = "https://letterboxd.com/itsMaday/film";

/** Zaid's April 2026 Letterboxd diary, newest first (Apr 26 → Apr 15). Stars null = unrated. */
const FILM_LOGS: { title: string; year: number; stars: number | null; slug: string }[] = [
  { title: "Ben-Hur", year: 1959, stars: 5, slug: "ben-hur-1959" },
  { title: "Yojimbo", year: 1961, stars: null, slug: "yojimbo" },
  { title: "The Aviator", year: 2004, stars: 4.5, slug: "the-aviator" },
  { title: "A Clockwork Orange", year: 1971, stars: 5, slug: "a-clockwork-orange" },
  { title: "Mother Mary", year: 2026, stars: 3, slug: "mother-mary" },
  { title: "Lolita", year: 1962, stars: 4.5, slug: "lolita" },
  { title: "Spartacus", year: 1960, stars: 3.5, slug: "spartacus" },
  { title: "Whisper of the Heart", year: 1995, stars: 4.5, slug: "whisper-of-the-heart" },
  { title: "Licorice Pizza", year: 2021, stars: 3, slug: "licorice-pizza" },
  { title: "Hard Eight", year: 1996, stars: 3, slug: "hard-eight" },
  { title: "Cave of Forgotten Dreams", year: 2010, stars: 4, slug: "cave-of-forgotten-dreams" },
  { title: "Exit 8", year: 2025, stars: 3.5, slug: "exit-8" },
];

type Place = {
  slug: string;
  title: string;
  rating: number;
  date: string;
  address: string;
  lat: number;
  lng: number;
  cuisine: string;
  price: number;
  neighbourhood: string;
  city: string;
  region: Region;
  dishes: { name: string; mustOrder?: boolean }[];
};

/** Sample places (plausible, not Zaid's reviews). */
const PLACES: Place[] = [
  {
    slug: "la-taqueria",
    title: "La Taqueria",
    rating: 9,
    date: "2026-03-14",
    address: "2889 Mission St, San Francisco, CA 94110",
    lat: 37.7509,
    lng: -122.4181,
    cuisine: "Mexican",
    price: 1,
    neighbourhood: "Mission",
    city: "San Francisco",
    region: "SAN_FRANCISCO",
    dishes: [
      { name: "Carnitas super burrito, dorado style", mustOrder: true },
      { name: "Carne asada taco" },
      { name: "Agua fresca de sandía" },
    ],
  },
  {
    slug: "tartine-bakery",
    title: "Tartine Bakery",
    rating: 8,
    date: "2026-02-08",
    address: "600 Guerrero St, San Francisco, CA 94110",
    lat: 37.7614,
    lng: -122.4241,
    cuisine: "Bakery",
    price: 2,
    neighbourhood: "Mission",
    city: "San Francisco",
    region: "SAN_FRANCISCO",
    dishes: [{ name: "Morning bun", mustOrder: true }, { name: "Frangipane croissant" }, { name: "Country loaf" }],
  },
  {
    slug: "marufuku-ramen",
    title: "Marufuku Ramen",
    rating: 8,
    date: "2026-01-23",
    address: "1581 Webster St, San Francisco, CA 94115",
    lat: 37.7853,
    lng: -122.432,
    cuisine: "Japanese",
    price: 2,
    neighbourhood: "Japantown",
    city: "San Francisco",
    region: "SAN_FRANCISCO",
    dishes: [{ name: "Hakata tonkotsu DX", mustOrder: true }, { name: "Chicken paitan" }],
  },
  {
    slug: "state-bird-provisions",
    title: "State Bird Provisions",
    rating: 9,
    date: "2025-12-12",
    address: "1529 Fillmore St, San Francisco, CA 94115",
    lat: 37.7837,
    lng: -122.4329,
    cuisine: "Californian",
    price: 3,
    neighbourhood: "Fillmore",
    city: "San Francisco",
    region: "SAN_FRANCISCO",
    dishes: [
      { name: "State bird with provisions", mustOrder: true },
      { name: "Garlic bread with burrata" },
      { name: "Pork belly salad" },
    ],
  },
  {
    slug: "burma-superstar",
    title: "Burma Superstar",
    rating: 8,
    date: "2025-11-29",
    address: "309 Clement St, San Francisco, CA 94118",
    lat: 37.783,
    lng: -122.4627,
    cuisine: "Burmese",
    price: 2,
    neighbourhood: "Inner Richmond",
    city: "San Francisco",
    region: "SAN_FRANCISCO",
    dishes: [{ name: "Tea leaf salad", mustOrder: true }, { name: "Rainbow salad" }, { name: "Samusa soup" }],
  },
  {
    slug: "cheese-board-pizza",
    title: "Cheese Board Pizza",
    rating: 9,
    date: "2026-04-04",
    address: "1512 Shattuck Ave, Berkeley, CA 94709",
    lat: 37.88,
    lng: -122.2695,
    cuisine: "Pizza",
    price: 1,
    neighbourhood: "North Berkeley",
    city: "Berkeley",
    region: "EAST_BAY",
    dishes: [{ name: "Daily vegetarian pizza, half sheet", mustOrder: true }, { name: "Green sauce on the side" }],
  },
  {
    slug: "comal",
    title: "Comal",
    rating: 6,
    date: "2026-02-21",
    address: "2020 Shattuck Ave, Berkeley, CA 94704",
    lat: 37.8716,
    lng: -122.2683,
    cuisine: "Mexican",
    price: 2,
    neighbourhood: "Downtown Berkeley",
    city: "Berkeley",
    region: "EAST_BAY",
    // No must-order dish: the detail card must handle that.
    dishes: [{ name: "Wood-grilled rock cod tacos" }, { name: "Guacamole and chips" }],
  },
  {
    slug: "zacharys-chicago-pizza",
    title: "Zachary's Chicago Pizza",
    rating: 7,
    date: "2025-10-18",
    address: "5801 College Ave, Oakland, CA 94618",
    lat: 37.8466,
    lng: -122.252,
    cuisine: "Pizza",
    price: 2,
    neighbourhood: "Rockridge",
    city: "Oakland",
    region: "EAST_BAY",
    dishes: [{ name: "Spinach and mushroom stuffed pizza", mustOrder: true }, { name: "House salad" }],
  },
];

/** Top 4 films, by film-log title (each is one of FILM_LOGS). */
const FAVORITE_FILMS = ["Ben-Hur", "A Clockwork Orange", "Whisper of the Heart", "The Aviator"];

/** Top 4 albums, free-text snapshots (no review behind them). */
const FAVORITE_ALBUMS: { title: string; artist: string; year: number }[] = [
  { title: "Marty Supreme (Original Soundtrack)", artist: "Daniel Lopatin", year: 2025 },
  { title: "Blonde", artist: "Frank Ocean", year: 2016 },
  { title: "In Rainbows", artist: "Radiohead", year: 2007 },
  { title: "IGOR", artist: "Tyler, The Creator", year: 2019 },
];

/** A sample stats.fm 7-day window, rank 1 first. No cover art (coverUrl ""). */
const ALBUM_LISTENS: { title: string; artist: string; year: number; streams: number }[] = [
  { title: "Marty Supreme (Original Soundtrack)", artist: "Daniel Lopatin", year: 2025, streams: 64 },
  { title: "Blonde", artist: "Frank Ocean", year: 2016, streams: 41 },
  { title: "In Rainbows", artist: "Radiohead", year: 2007, streams: 33 },
  { title: "Mr. Morale & the Big Steppers", artist: "Kendrick Lamar", year: 2022, streams: 27 },
  { title: "Promises", artist: "Floating Points, Pharoah Sanders & LSO", year: 2021, streams: 19 },
  { title: "IGOR", artist: "Tyler, The Creator", year: 2019, streams: 12 },
];

const SAMPLE_NOTE = p("Sample post for local development.");

type SamplePost = {
  slug: string;
  title: string;
  excerpt: string;
  category: Category;
  publishedAt: string;
  tags: string[];
  blocks: PartialPostBlock[];
  reviewId?: string;
};

const BEN_HUR_REVIEW_ID = "dev-fixture-review-ben-hur";

const POSTS: SamplePost[] = [
  {
    slug: "notes-on-spaced-repetition",
    title: "Notes on spaced repetition",
    excerpt: "What actually stuck after a semester of flashcards.",
    category: "NOTES",
    publishedAt: "2026-01-12",
    tags: ["learning"],
    blocks: [
      h2("The short version"),
      p("Review just before you would forget. The gaps grow each time you get a card right."),
      h2("What worked"),
      bullet("Small cards: one fact each."),
      bullet("Reviewing every day, even for five minutes."),
      bullet("Writing my own cards instead of downloading decks."),
      callout("Delete cards you keep failing and rewrite them smaller.", "tip"),
    ],
  },
  {
    slug: "median-vs-mean-for-ratings",
    title: "Why the median beats the mean for food ratings",
    excerpt: "One bad night shouldn't sink a place I love.",
    category: "STATISTICS",
    publishedAt: "2026-02-03",
    tags: ["statistics", "ratings"],
    blocks: [
      p("Averages move a lot when one visit goes badly. The median barely notices."),
      h2("The setup"),
      math("\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i"),
      p("With five visits rated 9, 9, 8, 9 and 2, the mean is 7.4 but the median is 9."),
      h2("When the mean is still right"),
      p("If every visit matters equally, like a price you pay each time, use the mean."),
    ],
  },
  {
    slug: "render-on-save",
    title: "Rendering blog posts on save, not on request",
    excerpt: "Why this site stores HTML next to the editor JSON.",
    category: "COMPUTER_SCIENCE",
    publishedAt: "2026-02-27",
    tags: ["next.js", "web"],
    blocks: [
      p("Every post is stored twice: the editor's JSON and the HTML it renders to."),
      h2("The trade-off"),
      p("Saving is a little slower. Reading costs nothing, because the page just prints a string."),
      code("ts", "const html = await renderPostHtml(post.blocks);\nawait db.post.update({ where: { id }, data: { html } });"),
      callout("The HTML is sanitised before it's stored, so the page can trust it.", "warning"),
    ],
  },
  {
    slug: "a-diary-of-small-things",
    title: "On keeping a diary of small things",
    excerpt: "Logging films and meals turned out to be a memory aid.",
    category: "PHILOSOPHY",
    publishedAt: "2026-03-09",
    tags: ["writing"],
    blocks: [
      p("I started logging what I watched to remember titles. It ended up recording whole evenings."),
      quote("We do not remember days, we remember moments."),
      p("A rating is a bookmark. The note next to it is the page."),
    ],
  },
  {
    slug: "a-burrito-crawl-through-the-mission",
    title: "A burrito crawl through the Mission",
    excerpt: "Three taquerias, one afternoon, no regrets.",
    category: "FOOD",
    publishedAt: "2026-03-21",
    tags: ["bay area", "burritos"],
    blocks: [
      p("The rule was simple: one burrito per stop, shared three ways."),
      h2("The stops"),
      bullet("La Taqueria: no rice, crisped on the plancha."),
      bullet("A smaller spot on 24th that I'll keep to myself."),
      bullet("A late-night stop that tasted better than it should have."),
      h2("The winner"),
      p("La Taqueria, again. Order it dorado style."),
    ],
  },
  {
    slug: "albums-on-repeat",
    title: "Albums on repeat this spring",
    excerpt: "What kept coming back on the walk to class.",
    category: "MUSIC",
    publishedAt: "2026-04-10",
    tags: ["playlists"],
    blocks: [
      p("A short list of records I didn't skip a track on."),
      h2("Why these"),
      p("Each one works start to finish, which is rarer than it should be."),
    ],
  },
  {
    slug: "ben-hur-sixty-seven-years-later",
    title: "Ben-Hur, sixty-seven years later",
    excerpt: "The chariot race still holds up, and so does the rest.",
    category: "FILM",
    publishedAt: "2026-04-27",
    tags: ["letterboxd", "epics"],
    reviewId: BEN_HUR_REVIEW_ID,
    blocks: [
      h2("First impressions"),
      p("Nearly four hours, and I never checked the time."),
      h2("What worked"),
      p("The chariot race is the obvious answer. The galley scenes are the better one."),
      h2("The verdict"),
      p("A full ten. Watch it on the biggest screen you can find."),
    ],
  },
  {
    slug: "rebuilding-zaidmadanat-com",
    title: "Rebuilding zaidmadanat.com",
    excerpt: "From one static page to a site with a blog, reviews and a map.",
    category: "PROJECTS",
    publishedAt: "2026-04-30",
    tags: ["next.js", "web"],
    blocks: [
      h2("What it is"),
      p("A personal site with a blog, food, film and music reviews, and a contact page."),
      h2("How it works"),
      bullet("Next.js with static pages that rebuild through cache tags."),
      bullet("Postgres through Prisma for posts, reviews and synced data."),
      bullet("Letterboxd, stats.fm and Strava sync once a day."),
    ],
  },
];

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const noon = (iso: string) => new Date(`${iso}T19:00:00.000Z`);

async function seedFixtures(db: PrismaClient) {
  // Film logs: one diary entry per day, Apr 26 back to Apr 15.
  const logIds = new Map<string, string>();
  for (const [i, f] of FILM_LOGS.entries()) {
    const watched = new Date(Date.UTC(2026, 3, 26 - i));
    const guid = `letterboxd-watch-dev-fixture-${f.slug}`;
    const data = {
      letterboxdGuid: guid,
      entryType: "WATCH" as const,
      title: f.title,
      year: f.year,
      stars: f.stars,
      rating: starsToTen(f.stars),
      watchedAt: watched,
      liked: f.stars === 5,
      url: `${LB}/${f.slug}/`,
    };
    const log = await db.filmLog.upsert({ where: { letterboxdGuid: guid }, create: data, update: data });
    logIds.set(f.title, log.id);
  }

  // Food places, each a FOOD review with its dishes (replaced on re-run).
  for (const { slug, dishes, date, ...place } of PLACES) {
    const id = `dev-fixture-food-${slug}`;
    const data = { kind: "FOOD" as const, date: day(date), ...place };
    await db.review.upsert({ where: { id }, create: { id, ...data }, update: data });
    await db.dish.deleteMany({ where: { reviewId: id } });
    await db.dish.createMany({
      data: dishes.map((d, order) => ({ reviewId: id, name: d.name, mustOrder: d.mustOrder ?? false, order })),
    });
  }

  // The Ben-Hur FILM review, linked to its log and (below) to a post.
  const benHur = {
    kind: "FILM" as const,
    title: "Ben-Hur",
    rating: 10,
    date: day("2026-04-26"),
    filmLogId: logIds.get("Ben-Hur")!,
  };
  await db.review.upsert({
    where: { id: BEN_HUR_REVIEW_ID },
    create: { id: BEN_HUR_REVIEW_ID, ...benHur },
    update: benHur,
  });

  // Favourites: unique on (kind, position), so upsert by that.
  const favorites = [
    ...FAVORITE_FILMS.map((title, i) => ({
      kind: "FILM" as const,
      position: i + 1,
      title,
      year: FILM_LOGS.find((f) => f.title === title)!.year,
      artist: null,
      filmLogId: logIds.get(title)!,
    })),
    ...FAVORITE_ALBUMS.map((a, i) => ({ kind: "ALBUM" as const, position: i + 1, ...a, filmLogId: null })),
  ];
  for (const fav of favorites) {
    const where = { kind_position: { kind: fav.kind, position: fav.position } };
    const id = `dev-fixture-fav-${fav.kind.toLowerCase()}-${fav.position}`;
    await db.favorite.upsert({ where, create: { id, ...fav }, update: fav });
  }

  // A stats.fm window ending now (a real sync replaces the whole table).
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 7 * 86_400_000);
  await db.albumListen.deleteMany({ where: { id: { startsWith: "dev-fixture-album-" } } });
  await db.albumListen.createMany({
    data: ALBUM_LISTENS.map((a, i) => ({
      id: `dev-fixture-album-${i + 1}`,
      statsfmAlbumId: `dev-fixture-${i + 1}`,
      ...a,
      coverUrl: "",
      rank: i + 1,
      windowStart,
      windowEnd,
    })),
  });

  // Posts, all published and already "notified" so no new-post email ever fires for them.
  for (const post of POSTS) {
    const blocks = [...post.blocks, SAMPLE_NOTE];
    const publishedAt = noon(post.publishedAt);
    const data = {
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      blocks: asJson(blocks),
      html: await renderPostHtml(blocks),
      readingMinutes: readingMinutes(plainText(blocks)),
      status: "PUBLISHED" as const,
      publishedAt,
      notifiedAt: publishedAt,
      reviewId: post.reviewId ?? null,
    };
    const saved = await db.post.upsert({
      where: { slug: post.slug },
      create: { id: `dev-fixture-post-${post.slug}`, slug: post.slug, ...data },
      update: data,
    });
    await db.postTag.deleteMany({ where: { postId: saved.id } });
    for (const name of post.tags) {
      const tag = await db.tag.upsert({ where: { name }, create: { name }, update: {} });
      await db.postTag.create({ data: { postId: saved.id, tagId: tag.id } });
    }
  }
}

// ---------------------------------------------------------------- entry points

export async function seed(db: PrismaClient, { fixtures }: { fixtures: boolean }): Promise<void> {
  await seedTemplates(db);
  if (fixtures) await seedFixtures(db);
}

function isLocalDatabase(url: string | undefined): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
}

async function main() {
  const fixtures = process.env.SEED_FIXTURES === "1";
  if (fixtures && !isLocalDatabase(process.env.DATABASE_URL)) {
    throw new Error("SEED_FIXTURES=1 only runs against a local database (dev-only sample data).");
  }
  const db = getDb();
  try {
    await seed(db, { fixtures });
    console.log(`Seeded ${BUILT_IN_TEMPLATES.length} built-in templates${fixtures ? " + dev fixtures" : ""}.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

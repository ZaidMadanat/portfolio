import { describe, expect, it } from "vitest";
import { blogQueryString, filterPosts, parseBlogQuery } from "@/lib/blog-filters";
import type { PostSummary } from "@/lib/queries/posts";

// The canvas Blog board's 8 sample posts.
const post = (
  slug: string,
  title: string,
  excerpt: string,
  category: PostSummary["category"],
  tags: string[],
  publishedAt: string,
  readingMinutes: number,
  rating: number | null = null,
): PostSummary => ({
  id: slug,
  slug,
  title,
  excerpt,
  category,
  tags,
  publishedAt,
  year: publishedAt.slice(0, 4),
  readingMinutes,
  rating,
});

const POSTS: PostSummary[] = [
  post("stat-134", "Stat 134 cheat sheet: the distributions you actually need", "Binomial, Poisson, geometric, normal: when each one shows up, what to memorize, and the shortcuts that save you on exams.", "Notes", ["probability", "cheat-sheet", "berkeley"], "2026-10-21T19:00:00.000Z", 8),
  post("reward-hacking", "Reward hacking, explained with a cleaning robot", "What building a green agent for the Alfred benchmark taught me about agents that technically finish the task.", "Computer Science", ["ai", "rl", "agents"], "2026-09-30T19:00:00.000Z", 11),
  post("careless-agent", "Can an agent be careless?", 'Notes on side effects, blame and whether "noise in the environment" is a moral idea or just a metric.', "Philosophy", ["philosophy", "ai", "agents"], "2026-08-12T19:00:00.000Z", 9),
  post("transfer-learning", "Transfer learning, from the stats side", "Why fine-tuning works, told with priors and shrinkage instead of GPUs.", "Statistics", ["ai", "statistics"], "2026-06-04T19:00:00.000Z", 10),
  post("ben-hur", "Ben-Hur deserves its 11 Oscars", "Three and a half hours, one chariot race, and the best use of a widescreen frame I have seen.", "Film", ["film", "epics"], "2026-04-27T19:00:00.000Z", 4, 10),
  post("data-100", "Data 100 notes: pandas without tears", "Groupby, merge and pivot, with the mistakes I made so you do not have to.", "Notes", ["data", "python", "berkeley", "cheat-sheet"], "2026-02-09T19:00:00.000Z", 14),
  post("plateful", "Building Plateful in 36 hours", "Voice agents, a Kroger cart and very little sleep: a hackathon write-up.", "Projects", ["swift", "agents", "hackathon"], "2025-11-18T19:00:00.000Z", 7),
  post("clockwork", "A Clockwork Orange, fifty years on", "Still the most uncomfortable film I love.", "Film", ["film", "kubrick"], "2025-10-02T19:00:00.000Z", 3, 10),
];

const slugs = (posts: PostSummary[]) => posts.map((p) => p.slug);

describe("filterPosts", () => {
  it("returns everything for an empty query", () => {
    expect(filterPosts(POSTS, {})).toHaveLength(8);
  });

  it("filters by category", () => {
    expect(slugs(filterPosts(POSTS, { cat: "Notes" }))).toEqual(["stat-134", "data-100"]);
  });

  it("filters by tag", () => {
    expect(slugs(filterPosts(POSTS, { tag: "cheat-sheet" }))).toEqual(["stat-134", "data-100"]);
  });

  it("filters by reading time: short < 5, mid 5–10 inclusive, long > 10", () => {
    expect(slugs(filterPosts(POSTS, { time: "long" }))).toEqual(["reward-hacking", "data-100"]);
    expect(slugs(filterPosts(POSTS, { time: "short" }))).toEqual(["ben-hur", "clockwork"]);
    expect(slugs(filterPosts(POSTS, { time: "mid" }))).toEqual([
      "stat-134",
      "careless-agent",
      "transfer-learning",
      "plateful",
    ]);
  });

  it("combines filters, and a combination can match nothing", () => {
    expect(filterPosts(POSTS, { year: "2025", cat: "Statistics" })).toEqual([]);
    expect(slugs(filterPosts(POSTS, { year: "2025", cat: "Film" }))).toEqual(["clockwork"]);
    expect(slugs(filterPosts(POSTS, { tag: "agents", time: "long" }))).toEqual(["reward-hacking"]);
  });

  it("searches title and excerpt, case-insensitively, and nothing else", () => {
    expect(slugs(filterPosts(POSTS, { q: "PANDAS" }))).toEqual(["data-100"]);
    expect(slugs(filterPosts(POSTS, { q: "chariot race" }))).toEqual(["ben-hur"]);
    // "kubrick" is only a tag, never in the title or excerpt.
    expect(filterPosts(POSTS, { q: "kubrick" })).toEqual([]);
  });
});

describe("parseBlogQuery", () => {
  it("drops invalid values", () => {
    expect(parseBlogQuery(new URLSearchParams("cat=Nope&time=mid"))).toEqual({ time: "mid" });
    expect(parseBlogQuery(new URLSearchParams("year=20x6&time=forever&q=%20%20&tag="))).toEqual({});
  });

  it("keeps every valid value", () => {
    expect(
      parseBlogQuery(
        new URLSearchParams("cat=Computer+Science&tag=ai&year=2026&time=long&q=%20agents%20"),
      ),
    ).toEqual({ cat: "Computer Science", tag: "ai", year: "2026", time: "long", q: "agents" });
  });
});

describe("blogQueryString", () => {
  it("writes keys in a fixed order and skips empty ones", () => {
    expect(blogQueryString({ tag: "statistics", cat: "Statistics" })).toBe(
      "?cat=Statistics&tag=statistics",
    );
    expect(blogQueryString({ cat: "Computer Science", q: "a b" })).toBe("?cat=Computer+Science&q=a+b");
    expect(blogQueryString({})).toBe("");
  });

  it("round-trips through parseBlogQuery", () => {
    const q = { cat: "Film", tag: "epics", year: "2026", time: "short", q: "ben" } as const;
    expect(parseBlogQuery(new URLSearchParams(blogQueryString(q)))).toEqual(q);
  });
});

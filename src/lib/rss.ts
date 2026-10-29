import type { PostSummary } from "@/lib/queries/posts";

// RSS 2.0 for published posts (spec §6.9): title, link, date, excerpt, category.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
// Characters XML 1.0 forbids (C0 controls other than tab, LF, CR; lone surrogates; U+FFFE/FFFF).
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/g;

/** Escapes text for an XML element or attribute, dropping characters XML can't hold. */
export function escapeXml(text: string): string {
  return text.replace(INVALID, "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export const FEED_TITLE = "Zaid Madanat";
export const FEED_DESCRIPTION =
  "Posts by Zaid Madanat: statistics, computer science, philosophy, film, food and music.";

type FeedPost = Pick<PostSummary, "slug" | "title" | "excerpt" | "category" | "publishedAt">;

/** `posts` newest first. RFC 822 dates; lastBuildDate is the newest post, so the feed is deterministic. */
export function buildRssFeed({ siteUrl, posts }: { siteUrl: string; posts: FeedPost[] }): string {
  const date = (iso: string) => new Date(iso).toUTCString();
  const items = posts.map((p) => {
    const link = escapeXml(`${siteUrl}/blog/${encodeURIComponent(p.slug)}`);
    return [
      "    <item>",
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <pubDate>${date(p.publishedAt)}</pubDate>`,
      `      <description>${escapeXml(p.excerpt)}</description>`,
      `      <category>${escapeXml(p.category)}</category>`,
      "    </item>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(FEED_TITLE)}</title>`,
    `    <link>${escapeXml(`${siteUrl}/blog`)}</link>`,
    `    <description>${escapeXml(FEED_DESCRIPTION)}</description>`,
    "    <language>en-us</language>",
    `    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...(posts[0] ? [`    <lastBuildDate>${date(posts[0].publishedAt)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

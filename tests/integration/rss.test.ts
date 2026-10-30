import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// Outside Next there's no incremental cache: run the tagged reads directly.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");

const { GET, dynamic, revalidate } = await import("@/app/rss.xml/route");

beforeEach(resetDb);

const base = { blocks: [], html: "<p>Hi</p>" };

async function feed() {
  const res = await GET();
  return { res, xml: await res.text() };
}

const items = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

describe("/rss.xml", () => {
  it("is static", () => {
    expect(dynamic).toBe("force-static");
    expect(revalidate).toBe(false);
  });

  it("serves RSS 2.0 with the channel title, published posts newest first, categories and escaping", async () => {
    await db.post.create({
      data: {
        ...base,
        slug: "older",
        title: "Older",
        excerpt: "First one",
        category: "COMPUTER_SCIENCE",
        status: "PUBLISHED",
        publishedAt: new Date("2026-01-02T10:00:00Z"),
      },
    });
    await db.post.create({
      data: {
        ...base,
        slug: "newer",
        title: "Tea & Toast <3",
        excerpt: 'Quotes "and" apostrophes \' & ampersands',
        category: "FOOD",
        status: "PUBLISHED",
        publishedAt: new Date("2026-04-27T19:00:00Z"),
      },
    });
    await db.post.create({ data: { ...base, slug: "draft", title: "A draft", category: "NOTES" } });

    const { res, xml } = await feed();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toMatch(/<channel>\s*<title>Zaid Madanat<\/title>/);
    expect(xml).toContain("<link>https://example.test/blog</link>");
    expect(xml).toContain('<atom:link href="https://example.test/rss.xml" rel="self" type="application/rss+xml"/>');

    const [first, second, ...rest] = items(xml);
    expect(rest).toHaveLength(0);
    expect(xml).not.toContain("A draft");

    expect(first).toContain("<title>Tea &amp; Toast &lt;3</title>");
    expect(first).toContain("<link>https://example.test/blog/newer</link>");
    expect(first).toContain('<guid isPermaLink="true">https://example.test/blog/newer</guid>');
    expect(first).toContain("<pubDate>Mon, 27 Apr 2026 19:00:00 GMT</pubDate>");
    expect(first).toContain("<description>Quotes &quot;and&quot; apostrophes &apos; &amp; ampersands</description>");
    expect(first).toContain("<category>Food</category>");

    expect(second).toContain("<title>Older</title>");
    expect(second).toContain("<category>Computer Science</category>");
    expect(xml).toContain("<lastBuildDate>Mon, 27 Apr 2026 19:00:00 GMT</lastBuildDate>");
  });

  it("is a valid, empty channel with no posts", async () => {
    const { res, xml } = await feed();
    expect(res.status).toBe(200);
    expect(xml).toMatch(/<channel>\s*<title>Zaid Madanat<\/title>/);
    expect(items(xml)).toHaveLength(0);
    expect(xml).not.toContain("<lastBuildDate>");
    expect(xml.trimEnd().endsWith("</rss>")).toBe(true);
  });
});

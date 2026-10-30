import { getFeedPosts } from "@/lib/queries/posts";
import { buildRssFeed } from "@/lib/rss";
import { siteUrl } from "@/lib/site";

// Static (spec §6.9, §3.1). Built once; the read is tagged `rss` and `posts`,
// so a post write (revalidateFor("post")) rebuilds it.
export const dynamic = "force-static";
export const revalidate = false;

export async function GET(): Promise<Response> {
  const xml = buildRssFeed({ siteUrl: siteUrl(), posts: await getFeedPosts() });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

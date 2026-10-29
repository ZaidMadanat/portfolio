import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlogFilters } from "@/features/blog/BlogFilters";
import { SubscribeBanner } from "@/features/blog/SubscribeBanner";
import { getPublishedPosts } from "@/lib/queries/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes, essays and write-ups by Zaid Madanat: statistics, computer science, philosophy, film, food and music.",
};

// Static; rebuilt only when the `posts` tag is revalidated (spec §7.3).
// Filters run in the browser (BlogFilters), so the server never reads the query.
export const revalidate = false;

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-display text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight">
        The blog
      </h1>
      {posts.length === 0 ? <EmptyState title="No posts yet." /> : <BlogFilters posts={posts} />}
      <div className="mt-6">
        <SubscribeBanner variant="banner" />
      </div>
    </div>
  );
}

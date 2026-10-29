import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { KeepReading } from "@/features/blog/KeepReading";
import { PostActions, ViewCount } from "@/features/blog/PostActions";
import { CategoryPill, tagLine } from "@/features/blog/PostCard";
import { RatingBox } from "@/features/blog/RatingBox";
import { SubscribeBanner } from "@/features/blog/SubscribeBanner";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";
import { getKeepReading, getPostBySlug, getPublishedPosts, getRedirectSlugs } from "@/lib/queries/posts";
import "../prose.css";

// Static: every published slug is prerendered, and a slug published later
// renders on first request and is then cached (ISR). Rebuilt only through the
// `posts` and `post:<id>` tags (spec §7.3). Counters load in the browser.
export const revalidate = false;
export const dynamicParams = true;

// Old slugs are prerendered as their 308s (see getRedirectSlugs).
export async function generateStaticParams() {
  const [posts, oldSlugs] = await Promise.all([getPublishedPosts(), getRedirectSlugs()]);
  return [...posts.map((p) => p.slug), ...oldSlugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const found = await getPostBySlug((await params).slug);
  if (!found || !("post" in found)) return {};
  const { post } = found;
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt || undefined, publishedTime: post.publishedAt },
  };
}

/** KaTeX output carries class="katex"; only those posts load its stylesheet. */
const hasMath = (html: string) => html.includes('class="katex');

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const found = await getPostBySlug((await params).slug);
  if (!found) notFound();
  if ("redirectTo" in found) permanentRedirect(found.redirectTo);
  const { post } = found;
  const more = await getKeepReading(post);
  const tags = tagLine(post.tags);

  return (
    <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      {/* React hoists this into <head>; posts without math never load it. A CSS
          import can't do this: it would apply to every post on the route. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      {hasMath(post.html) ? <link rel="stylesheet" href="/katex/katex.min.css" precedence="default" /> : null}

      <Link
        href="/blog"
        className="inline-flex min-h-11 items-center self-start font-semibold text-accent-ink underline-offset-2 hover:underline"
      >
        ← All posts
      </Link>
      <div data-testid="post-meta" className="flex flex-wrap items-center gap-2">
        <CategoryPill category={post.category} />
        <span className="text-[15px] text-muted">
          {formatDate(post.publishedAt, SITE_TIME_ZONE)} · {post.readingMinutes} min read
          <ViewCount postId={post.id} />
        </span>
      </div>
      <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[1.02] font-extrabold tracking-tight text-balance">
        {post.title}
      </h1>

      {post.review ? <RatingBox review={post.review} /> : null}

      {/* Sanitised when it was rendered on save (src/lib/blocks/render.ts). */}
      <div className="prose mt-2" dangerouslySetInnerHTML={{ __html: post.html }} />

      {tags ? <p className="text-[15px] text-muted">{tags}</p> : null}
      <PostActions postId={post.id} slug={post.slug} />
      <SubscribeBanner variant="box" />
      <div className="pt-4">
        <KeepReading posts={more} />
      </div>
    </article>
  );
}

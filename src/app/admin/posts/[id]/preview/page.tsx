import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPill } from "@/features/blog/PostCard";
import { categoryLabel } from "@/lib/categories";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import "@/app/(site)/blog/prose.css";

export const metadata: Metadata = { title: "Preview" };

// What a post will look like, drafts included: the stored html (rendered on
// every save) in the public prose styles. Admin only.
export default async function PreviewPostPage({ params }: PageProps<"/admin/posts/[id]/preview">) {
  await requireAdmin();
  const post = await db.post.findUnique({
    where: { id: (await params).id },
    select: { title: true, html: true, category: true, status: true, readingMinutes: true },
  });
  if (!post) notFound();

  return (
    <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      {post.html.includes('class="katex') ? <link rel="stylesheet" href="/katex/katex.min.css" precedence="default" /> : null}
      <p className="rounded-2xl border-2 border-dashed border-ink bg-soft px-4 py-3 font-semibold">
        {post.status === "PUBLISHED"
          ? "Preview. This post is live."
          : "Preview of a draft. It isn't public yet."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CategoryPill category={categoryLabel(post.category)} />
        <span className="text-[15px] text-muted">{post.readingMinutes} min read</span>
      </div>
      <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[1.02] font-extrabold tracking-tight text-balance">
        {post.title || "Untitled"}
      </h1>
      <div className="prose mt-2" dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}

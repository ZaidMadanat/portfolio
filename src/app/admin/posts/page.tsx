import type { Metadata } from "next";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { listAdminPosts, parsePostFilter, POST_FILTERS } from "@/lib/admin/posts";
import { listTemplates } from "@/lib/admin/templates";
import { categoryLabel } from "@/lib/categories";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Posts" };

// The posts list (spec §7): every post with its status, filtered by
// ?status=draft|published (admin pages are dynamic, so reading searchParams
// here is fine). "+ New post" is a plain GET form to /admin/posts/new, a full
// page navigation: a router prefetch must never create a draft.
export default async function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  await requireAdmin();
  const filter = parsePostFilter((await searchParams).status);
  const [{ rows, counts }, templates] = await Promise.all([listAdminPosts(filter), listTemplates()]);
  const empty = POST_FILTERS.find((f) => f.id === filter)!;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold">Posts</h1>
        <form action="/admin/posts/new" method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            Template
            <select
              name="template"
              defaultValue=""
              className="min-h-11 rounded-xl border-2 border-ink bg-surface px-3 font-semibold text-ink"
            >
              <option value="">Blank</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl border-2 border-ink bg-accent px-5 font-extrabold text-on-accent shadow-hard"
          >
            + New post
          </button>
        </form>
      </div>

      <nav aria-label="Filter posts">
        <ul className="flex flex-wrap gap-1.5">
          {POST_FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <li key={f.id}>
                <Link
                  href={f.id === "all" ? "/admin/posts" : `/admin/posts?status=${f.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 font-bold ${
                    on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
                  }`}
                >
                  {f.label}
                  <span className={on ? "text-bg" : "text-muted"}>{counts[f.id]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length > 0 ? (
        <ul aria-label="Posts" className="flex flex-col gap-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 border-ink bg-surface p-4"
            >
              <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
                <Link
                  href={`/admin/posts/${p.id}`}
                  className="min-h-6 font-display text-lg font-bold break-words hover:text-accent-ink"
                >
                  {p.title.trim() || "Untitled draft"}
                </Link>
                <p className="text-sm text-muted">
                  {categoryLabel(p.category)}
                  {p.templateName ? ` · ${p.templateName}` : ""}
                  {" · "}
                  {p.status === "PUBLISHED" && p.publishedAt
                    ? `published ${formatDate(p.publishedAt, SITE_TIME_ZONE)}`
                    : `edited ${formatDate(p.updatedAt, SITE_TIME_ZONE)}`}
                </p>
              </div>
              <span data-testid="post-row-status">
                <Pill tone={p.status === "PUBLISHED" ? "soft2" : "outline"}>
                  {p.status === "PUBLISHED" ? "Published" : "Draft"}
                </Pill>
              </span>
              <div className="flex flex-wrap gap-2">
                {p.status === "PUBLISHED" ? (
                  <Link
                    href={`/blog/${p.slug}`}
                    aria-label={`View ${p.title.trim() || "post"} on the site`}
                    className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink px-3.5 font-semibold hover:bg-soft"
                  >
                    View
                  </Link>
                ) : null}
                <Link
                  href={`/admin/posts/${p.id}`}
                  aria-label={`Edit ${p.title.trim() || "untitled draft"}`}
                  className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-ink px-3.5 font-semibold text-bg"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold">
            {filter === "all" ? "No posts yet." : `No ${empty.label.toLowerCase()} right now.`}
          </p>
          {filter === "all" ? null : (
            <Link
              href="/admin/posts"
              className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-accent px-5 font-bold text-on-accent shadow-hard"
            >
              Show all posts
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

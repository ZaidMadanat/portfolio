"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  type BlogQuery,
  blogQueryString,
  filterPosts,
  hasFilters,
  parseBlogQuery,
  READING_TIME_LABELS,
  READING_TIMES,
  type ReadingTime,
} from "@/lib/blog-filters";
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/categories";
import { plural } from "@/lib/format";
import type { PostSummary } from "@/lib/queries/posts";
import { PostCard } from "./PostCard";

type Props = { posts: PostSummary[] };

// The page is static (spec §3.1): the server never sees the query. The
// prerendered HTML is the Suspense fallback (every post, no filters); after
// hydration the URL drives the list.
export function BlogFilters({ posts }: Props) {
  return (
    <Suspense fallback={<BlogIndex posts={posts} query={{}} />}>
      <WithSearchParams posts={posts} />
    </Suspense>
  );
}

function WithSearchParams({ posts }: Props) {
  const searchParams = useSearchParams();
  const query = useMemo(() => parseBlogQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
  // Native replaceState is synced with useSearchParams by the Next router and,
  // unlike router.replace, doesn't refetch the route for every keystroke.
  // Pass null: Next copies its own history state in, and skips the sync for
  // state that already carries its internal markers.
  const onChange = (next: BlogQuery) =>
    window.history.replaceState(null, "", `${window.location.pathname}${blogQueryString(next)}`);
  return <BlogIndex posts={posts} query={query} onChange={onChange} />;
}

const LABEL = "text-[13px] font-bold text-muted";
const FIELD =
  "min-h-11 rounded-xl border-2 border-ink bg-bg px-3.5 py-2.5 text-ink placeholder:text-muted";
const CHIP = "min-h-11 cursor-pointer border-2 border-ink px-3.5 py-2 font-semibold";

function chipColours(on: boolean) {
  return on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft";
}

/** Sorted unique values, plus the current one if it isn't listed (so the control shows it). */
function options(values: string[], current: string | undefined, sort: (a: string, b: string) => number) {
  const set = new Set(values);
  if (current) set.add(current);
  return [...set].sort(sort);
}

function BlogIndex({
  posts,
  query,
  onChange,
}: Props & { query: BlogQuery; onChange?: (next: BlogQuery) => void }) {
  // The search box keeps its own text so typing never fights the URL.
  const [text, setText] = useState(query.q ?? "");
  const set = (patch: Partial<BlogQuery>) => onChange?.({ ...query, ...patch });
  const clear = () => {
    setText("");
    onChange?.({});
  };

  const years = useMemo(
    () => options(posts.map((p) => p.year), query.year, (a, b) => b.localeCompare(a)),
    [posts, query.year],
  );
  const tags = useMemo(
    () => options(posts.flatMap((p) => p.tags), query.tag, (a, b) => a.localeCompare(b)),
    [posts, query.tag],
  );
  const shown = useMemo(() => filterPosts(posts, query), [posts, query]);

  return (
    <div className="flex flex-col gap-8">
      <div
        role="search"
        aria-label="Filter posts"
        className="flex flex-col gap-4 rounded-3xl border-2 border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
            <label htmlFor="blog-q" className={LABEL}>
              Search
            </label>
            <input
              id="blog-q"
              type="search"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                set({ q: e.target.value });
              }}
              placeholder="Search titles and excerpts"
              className={FIELD}
            />
          </div>
          <div className="flex flex-[0_0_160px] flex-col gap-1.5">
            <label htmlFor="blog-year" className={LABEL}>
              Year
            </label>
            <select
              id="blog-year"
              value={query.year ?? ""}
              onChange={(e) => set({ year: e.target.value || undefined })}
              className={FIELD}
            >
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-labelledby="blog-time" className="flex min-w-0 flex-col gap-1.5">
            <span id="blog-time" className={LABEL}>
              Reading time
            </span>
            <div className="flex flex-wrap gap-1.5">
              {([undefined, ...READING_TIMES] as (ReadingTime | undefined)[]).map((t) => {
                const on = query.time === t;
                return (
                  <button
                    key={t ?? "any"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ time: t })}
                    className={`${CHIP} rounded-xl ${chipColours(on)}`}
                  >
                    {t ? READING_TIME_LABELS[t] : "Any"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div role="group" aria-labelledby="blog-cat" className="flex flex-wrap items-center gap-2">
          <span id="blog-cat" className={`${LABEL} mr-1`}>
            Category
          </span>
          {([undefined, ...BLOG_CATEGORIES] as (BlogCategory | undefined)[]).map((c) => {
            const on = query.cat === c;
            return (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => set({ cat: c })}
                className={`${CHIP} rounded-full px-4 font-bold ${chipColours(on)}`}
              >
                {c ?? "All"}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="blog-tag" className={LABEL}>
            Tags
          </label>
          <select
            id="blog-tag"
            value={query.tag ?? ""}
            onChange={(e) => set({ tag: e.target.value || undefined })}
            className={`${FIELD} min-w-0 flex-[0_1_240px]`}
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="font-semibold text-muted">
          {plural(shown.length, "post")}
        </p>
        {shown.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters."
            onClear={hasFilters(query) ? clear : undefined}
          />
        ) : (
          <ul aria-label="Posts" className="grid gap-5 md:grid-cols-2">
            {shown.map((post) => (
              <li key={post.id} className="min-w-0">
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

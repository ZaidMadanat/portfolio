"use client";

import { useEffect, useRef, useState } from "react";
import { getLikes, like, type LikeState, useViews } from "./post-counters";

const nf = new Intl.NumberFormat("en-US");
const count = (n: number, one: string) => `${nf.format(n)} ${n === 1 ? one : `${one}s`}`;

/** " · 1,204 views" for the post header, once the count has loaded. */
export function ViewCount({ postId }: { postId: string }) {
  const views = useViews(postId);
  return views == null ? null : <span> · {count(views, "view")}</span>;
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

type CopyState = "idle" | "copied" | "failed";
const COPY_LABEL: Record<CopyState, string> = { idle: "Copy link", copied: "Link copied", failed: "Couldn't copy" };

// Like (add-only), Copy link and the view count (spec §6.3 item 4).
export function PostActions({ postId, slug }: { postId: string; slug: string }) {
  const views = useViews(postId);
  const [likes, setLikes] = useState<LikeState | null>(null);
  const [pending, setPending] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let live = true;
    getLikes(postId).then((s) => {
      if (live && s) setLikes((prev) => (prev?.liked ? prev : s));
    });
    return () => {
      live = false;
      clearTimeout(copyTimer.current);
    };
  }, [postId]);

  async function onLike() {
    setPending(true);
    const s = await like(postId);
    if (s) setLikes(s);
    setPending(false);
  }

  async function onCopy() {
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/blog/${slug}`);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    copyTimer.current = setTimeout(() => setCopy("idle"), 2500);
  }

  const liked = likes?.liked ?? false;
  return (
    <div className="flex flex-wrap items-center gap-3 border-y-2 border-line py-4">
      <button
        type="button"
        onClick={onLike}
        disabled={liked || pending}
        className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-ink px-5 font-bold disabled:cursor-default ${
          liked ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-soft"
        }`}
      >
        <Heart filled={liked} />
        {liked ? "Liked" : "Like"}
      </button>
      <span data-testid="like-count" aria-live="polite" className="min-w-14 text-[15px] font-semibold text-muted">
        {likes ? count(likes.count, "like") : ""}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 border-line bg-surface px-5 font-semibold text-ink hover:border-ink"
      >
        <span aria-live="polite">{COPY_LABEL[copy]}</span>
      </button>
      <span className="ml-auto text-[15px] text-muted">{views == null ? "" : count(views, "view")}</span>
    </div>
  );
}

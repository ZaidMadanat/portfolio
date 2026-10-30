"use client";

import { useEffect, useState } from "react";

// Views and likes load in the browser after the static page (spec §3.1, §9).
// The header and the actions bar both show the view count, so the request is
// shared: one per post per page load, and one POST per browser session.

const views = new Map<string, Promise<number | null>>();

async function fetchViews(postId: string): Promise<number | null> {
  const key = `viewed:${postId}`;
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === "1";
  } catch {
    // Storage blocked: count the view; at worst it's counted again next load.
  }
  const res = await fetch(`/api/views/${encodeURIComponent(postId)}`, { method: seen ? "GET" : "POST" });
  if (!res.ok) return null;
  if (!seen) {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }
  const body = (await res.json()) as { count?: unknown };
  return typeof body.count === "number" ? body.count : null;
}

function loadViews(postId: string): Promise<number | null> {
  let p = views.get(postId);
  if (!p) {
    p = fetchViews(postId).catch(() => null);
    views.set(postId, p);
  }
  return p;
}

/** The post's view count, or null until it loads (or if it fails). */
export function useViews(postId: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadViews(postId).then((n) => {
      if (live) setCount(n);
    });
    return () => {
      live = false;
    };
  }, [postId]);
  return count;
}

export type LikeState = { count: number; liked: boolean };

export async function getLikes(postId: string): Promise<LikeState | null> {
  try {
    const res = await fetch(`/api/likes/${encodeURIComponent(postId)}`);
    return res.ok ? ((await res.json()) as LikeState) : null;
  } catch {
    return null;
  }
}

/** Add-only (spec §9.3): there's no unlike. */
export async function like(postId: string): Promise<LikeState | null> {
  try {
    const res = await fetch(`/api/likes/${encodeURIComponent(postId)}`, { method: "POST" });
    return res.ok ? ((await res.json()) as LikeState) : null;
  } catch {
    return null;
  }
}

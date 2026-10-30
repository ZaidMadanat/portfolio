import type { NextRequest } from "next/server";
import { getViews, recordView } from "@/lib/counters";
import { json, parsePostId, rateLimited, type PostIdContext } from "@/lib/counter-api";
import { getStore } from "@/lib/redis";

// View counter (spec §9.2). The client POSTs once per session
// (sessionStorage `viewed:<id>`); GET reads without incrementing.
// Default Node runtime: Next 16.4 deprecates "edge". The code is still
// Edge-safe (Web Crypto, fetch-based Upstash) if that ever changes.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: PostIdContext) {
  const postId = await parsePostId(ctx);
  if (!postId) return json({ error: "invalid post id" }, 400);
  return json({ count: await getViews(getStore(), postId) });
}

export async function POST(req: NextRequest, ctx: PostIdContext) {
  const postId = await parsePostId(ctx);
  if (!postId) return json({ error: "invalid post id" }, 400);
  if (await rateLimited(req)) return json({ error: "too many requests" }, 429);
  return json({ count: await recordView(getStore(), postId) });
}

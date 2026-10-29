import type { NextRequest } from "next/server";
import { getLikes, likePost } from "@/lib/counters";
import {
  json,
  likeSecret,
  parsePostId,
  rateLimited,
  readVid,
  type PostIdContext,
} from "@/lib/counter-api";
import { getStore } from "@/lib/redis";

// Add-only likes (spec §9.3). No DELETE: a like can't be taken back.
// Default Node runtime: Next 16.4 deprecates "edge". The code is still
// Edge-safe (Web Crypto, fetch-based Upstash) if that ever changes.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: PostIdContext) {
  const postId = await parsePostId(ctx);
  if (!postId) return json({ error: "invalid post id" }, 400);
  return json(await getLikes(getStore(), postId, readVid(req), likeSecret()));
}

export async function POST(req: NextRequest, ctx: PostIdContext) {
  const postId = await parsePostId(ctx);
  if (!postId) return json({ error: "invalid post id" }, 400);
  const vid = readVid(req);
  if (!vid) return json({ error: "missing visitor id" }, 400);
  if (await rateLimited(req)) return json({ error: "too many requests" }, 429);
  return json(await likePost(getStore(), postId, vid, likeSecret()));
}

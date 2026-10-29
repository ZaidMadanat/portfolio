import type { NextRequest } from "next/server";
import { z } from "zod";
import { visitorHash } from "./counters";
import { allowRequest } from "./redis";

// Shared plumbing for /api/views/* and /api/likes/*.

export const VID_COOKIE = "vid";
export const vidSchema = z.uuid();
const postIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export type PostIdContext = { params: Promise<{ postId: string }> };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function parsePostId(ctx: PostIdContext): Promise<string | null> {
  const parsed = postIdSchema.safeParse((await ctx.params).postId);
  return parsed.success ? parsed.data : null;
}

export function readVid(req: NextRequest): string | null {
  const parsed = vidSchema.safeParse(req.cookies.get(VID_COOKIE)?.value);
  return parsed.success ? parsed.data : null;
}

/**
 * LIKE_SECRET. Required on Vercel (preview and production). Local dev, tests
 * and local `next start` (e2e) fall back to a fixed dev value.
 */
export function likeSecret(): string {
  const secret = process.env.LIKE_SECRET;
  if (secret) return secret;
  if (process.env.VERCEL) throw new Error("LIKE_SECRET is not set");
  return "dev-only-like-secret";
}

/** Rate limit by a hashed client IP (never stored in the clear). */
export async function rateLimited(req: NextRequest): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return !(await allowRequest(await visitorHash(`ip:${ip}`, likeSecret())));
}

import { createHash, timingSafeEqual } from "node:crypto";

// Vercel calls each cron route with `Authorization: Bearer $CRON_SECRET`
// (spec §9.1). Anything else is refused, and an unset secret refuses everyone.

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * True only when `header` is exactly `Bearer <CRON_SECRET>`. Compared in
 * constant time over SHA-256 digests, so neither the content nor the length
 * of the secret leaks through timing.
 */
export function cronAuthorized(header: string | null, secret = process.env.CRON_SECRET?.trim()): boolean {
  if (!secret) return false;
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

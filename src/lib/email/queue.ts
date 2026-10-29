import { db } from "@/lib/db";
import type { Mailer } from "./send";
import { newPostEmail } from "./templates";

// Resumable new-post email (spec §9.4). Publishing queues one EmailSend per
// confirmed subscriber; drains send QUEUED rows in chunks until the queue is
// empty or the provider's quota is hit. Whatever's left stays QUEUED for the
// next run (the daily housekeeping cron, Task 32).

/**
 * Queues the new-post email for every confirmed subscriber. Does nothing for
 * a draft or a post whose `notifiedAt` is set, and never queues anyone twice.
 * With nobody to tell, the post is marked notified straight away, so a later
 * re-publish never sends. Returns the number of rows created.
 */
export async function enqueuePostNotification(postId: string): Promise<number> {
  const post = await db.post.findUnique({ where: { id: postId }, select: { status: true, notifiedAt: true } });
  if (!post || post.status !== "PUBLISHED" || post.notifiedAt) return 0;

  const subscribers = await db.subscriber.findMany({ where: { status: "CONFIRMED" }, select: { id: true } });
  if (subscribers.length === 0) {
    await db.post.updateMany({
      where: { id: postId, notifiedAt: null, emailSends: { none: { status: { in: ["QUEUED", "SENDING"] } } } },
      data: { notifiedAt: new Date() },
    });
    return 0;
  }
  const { count } = await db.emailSend.createMany({
    data: subscribers.map((s) => ({ postId, subscriberId: s.id })),
    skipDuplicates: true,
  });
  return count;
}

/** Rows a drain may send: queued, for a confirmed reader and a post that's still published. */
const sendable = {
  status: "QUEUED",
  subscriber: { status: "CONFIRMED" },
  post: { status: "PUBLISHED" },
} as const;

/** A claim older than this belongs to a drain that died (a crash or a timeout); its rows go back to the queue. */
export const STALE_CLAIM_MS = 30 * 60 * 1000;

/** Puts rows claimed by a dead drain back in the queue. Returns how many. */
async function releaseStaleClaims(): Promise<number> {
  const { count } = await db.emailSend.updateMany({
    where: { status: "SENDING", claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    data: { status: "QUEUED", claimedAt: null },
  });
  return count;
}

/**
 * Atomically claims up to `limit` sendable rows (QUEUED → SENDING), oldest
 * first. `FOR UPDATE SKIP LOCKED` makes a concurrent drain skip rows another
 * drain is claiming, and the outer `status = 'QUEUED'` re-check means a row is
 * only ever claimed once, so cron and "Run sync now" can drain together.
 */
async function claimBatch(limit: number): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "EmailSend" SET "status" = 'SENDING', "claimedAt" = now()
    WHERE "id" IN (
      SELECT e."id" FROM "EmailSend" e
      JOIN "Subscriber" s ON s."id" = e."subscriberId"
      JOIN "Post" p ON p."id" = e."postId"
      WHERE e."status" = 'QUEUED' AND s."status" = 'CONFIRMED' AND p."status" = 'PUBLISHED'
      ORDER BY e."createdAt" ASC, e."id" ASC
      LIMIT ${limit}
      FOR UPDATE OF e SKIP LOCKED
    ) AND "status" = 'QUEUED'
    RETURNING "id"`;
  return rows.map((r) => r.id);
}

/** Hands claimed rows that weren't sent back to the queue. */
async function release(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.emailSend.updateMany({
    where: { id: { in: ids }, status: "SENDING" },
    data: { status: "QUEUED", claimedAt: null },
  });
}

/**
 * Sends queued new-post emails, `chunk` per batch, oldest first. Safe to run
 * concurrently: each batch is claimed atomically (QUEUED → SENDING) before it
 * is sent, so no email goes out twice. Claims older than 30 minutes (a drain
 * that crashed) are re-queued first. Stops cleanly when the mailer reports the
 * quota (or sends fewer than asked); the unsent rest goes back to QUEUED for
 * the next run. Sets `notifiedAt` on every post whose queue is now empty. A
 * mailer error (other than quota) re-queues the unsent rows and propagates;
 * rows sent before it are already marked SENT.
 */
export async function drainEmailQueue(
  mailer: Mailer,
  { chunk = 100 }: { chunk?: number } = {},
): Promise<{ sent: number; remaining: number }> {
  await releaseStaleClaims();

  let sent = 0;
  for (;;) {
    const ids = await claimBatch(chunk);
    if (ids.length === 0) break;

    let unsent = ids;
    try {
      const batch = await db.emailSend.findMany({
        where: { id: { in: ids } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          post: { select: { title: true, excerpt: true, slug: true } },
          subscriber: { select: { email: true, unsubscribeToken: true } },
        },
      });
      const result = await mailer.sendBatch(batch.map((row) => newPostEmail(row.subscriber, row.post)));
      const done = batch.slice(0, Math.min(result.sent, batch.length)).map((row) => row.id);
      // Decided before the write: if marking SENT fails, the sent rows stay
      // SENDING (never straight back in the queue) and only the unsent go back.
      const doneSet = new Set(done);
      unsent = ids.filter((id) => !doneSet.has(id));
      if (done.length > 0) {
        await db.emailSend.updateMany({
          where: { id: { in: done }, status: "SENDING" },
          data: { status: "SENT", sentAt: new Date(), claimedAt: null },
        });
        sent += done.length;
      }
      if (result.quotaHit || done.length < batch.length) break;
    } finally {
      await release(unsent);
    }
  }

  await db.post.updateMany({
    where: {
      notifiedAt: null,
      status: "PUBLISHED",
      AND: [{ emailSends: { some: {} } }, { emailSends: { none: { status: { in: ["QUEUED", "SENDING"] } } } }],
    },
    data: { notifiedAt: new Date() },
  });

  return { sent, remaining: await db.emailSend.count({ where: sendable }) };
}

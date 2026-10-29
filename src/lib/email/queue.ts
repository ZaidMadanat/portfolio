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
      where: { id: postId, notifiedAt: null, emailSends: { none: { status: "QUEUED" } } },
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

/**
 * Sends queued new-post emails, `chunk` per batch, oldest first. Stops cleanly
 * when the mailer reports the quota (or sends fewer than asked); the rest stays
 * QUEUED for the next run. Sets `notifiedAt` on every post whose queue is now
 * empty. A mailer error (other than quota) propagates; rows sent before it
 * are already marked SENT.
 */
export async function drainEmailQueue(
  mailer: Mailer,
  { chunk = 100 }: { chunk?: number } = {},
): Promise<{ sent: number; remaining: number }> {
  let sent = 0;
  for (;;) {
    const batch = await db.emailSend.findMany({
      where: sendable,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: chunk,
      select: {
        id: true,
        post: { select: { title: true, excerpt: true, slug: true } },
        subscriber: { select: { email: true, unsubscribeToken: true } },
      },
    });
    if (batch.length === 0) break;

    const result = await mailer.sendBatch(batch.map((row) => newPostEmail(row.subscriber, row.post)));
    const done = batch.slice(0, Math.min(result.sent, batch.length)).map((row) => row.id);
    if (done.length > 0) {
      await db.emailSend.updateMany({
        where: { id: { in: done }, status: "QUEUED" },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent += done.length;
    }
    if (result.quotaHit || done.length < batch.length) break;
  }

  await db.post.updateMany({
    where: {
      notifiedAt: null,
      status: "PUBLISHED",
      AND: [{ emailSends: { some: {} } }, { emailSends: { none: { status: "QUEUED" } } }],
    },
    data: { notifiedAt: new Date() },
  });

  return { sent, remaining: await db.emailSend.count({ where: sendable }) };
}

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { EmailQuotaError, getMailer, type Mailer } from "./send";
import { confirmationEmail } from "./templates";

// Double opt-in sign-up (spec §9.4). The confirm and unsubscribe tokens are
// separate, so a forwarded confirmation can't unsubscribe anyone and an
// unsubscribe link can't confirm.

/** 32 random bytes as base64url (43 chars). */
export const newToken = () => randomBytes(32).toString("base64url");

/** Trimmed, lower-cased, valid email (254 chars max). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

/** Shape of a token we issue; anything else is rejected before a DB lookup. */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export type SubscribeResult = "pending" | "already";

/**
 * Stores a PENDING subscriber (or reuses one) and sends the confirmation.
 * Already confirmed gives "already" and sends nothing. A previously
 * unsubscribed reader starts over with fresh tokens. Throws on an invalid
 * email, and EmailQuotaError when the confirmation can't go out today.
 */
export async function subscribe(email: string, { mailer }: { mailer?: Mailer } = {}): Promise<SubscribeResult> {
  const address = emailSchema.parse(email);
  let sub = await db.subscriber.upsert({
    where: { email: address },
    create: { email: address, confirmToken: newToken(), unsubscribeToken: newToken() },
    update: {},
  });
  if (sub.status === "CONFIRMED") return "already";
  if (sub.status === "UNSUBSCRIBED") {
    sub = await db.subscriber.update({
      where: { id: sub.id },
      data: { status: "PENDING", confirmToken: newToken(), unsubscribeToken: newToken(), confirmedAt: null },
    });
  }
  const { sent } = await (mailer ?? getMailer()).sendBatch([confirmationEmail(sub)]);
  if (sent < 1) throw new EmailQuotaError();
  return "pending";
}

/** PENDING → CONFIRMED. Idempotent for a confirmed reader; "invalid" for unknown tokens and unsubscribed readers. */
export async function confirmSubscription(token: string): Promise<"confirmed" | "invalid"> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return "invalid";
  const sub = await db.subscriber.findUnique({ where: { confirmToken: parsed.data } });
  if (!sub || sub.status === "UNSUBSCRIBED") return "invalid";
  if (sub.status === "PENDING") {
    await db.subscriber.update({ where: { id: sub.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  }
  return "confirmed";
}

/** Unsubscribes by the unsubscribe token only, and drops that reader's queued sends. Idempotent. */
export async function unsubscribe(token: string): Promise<"unsubscribed" | "invalid"> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return "invalid";
  const sub = await db.subscriber.findUnique({ where: { unsubscribeToken: parsed.data } });
  if (!sub) return "invalid";
  await db.$transaction([
    db.subscriber.update({ where: { id: sub.id }, data: { status: "UNSUBSCRIBED" } }),
    db.emailSend.deleteMany({ where: { subscriberId: sub.id, status: "QUEUED" } }),
  ]);
  return "unsubscribed";
}

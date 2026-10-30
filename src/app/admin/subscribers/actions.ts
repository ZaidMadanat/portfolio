"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

// Subscribers admin actions (spec §7). Each checks the admin session first.

const subscriberId = z.string().min(1).max(64);

/**
 * Deletes a subscriber outright, with their queued and sent email records
 * (EmailSend cascades). Someone already gone is a no-op.
 */
export async function removeSubscriber(id: string): Promise<void> {
  await requireAdmin();
  await db.subscriber.deleteMany({ where: { id: subscriberId.parse(id) } });
}

import type { SubscriberStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// The subscribers admin page and CSV export (spec §7). Callers check the
// admin session. Tokens never leave the database.

export type AdminSubscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  createdAt: Date;
  confirmedAt: Date | null;
};

/** Everyone, newest first. */
export async function listSubscribers(): Promise<AdminSubscriber[]> {
  return db.subscriber.findMany({
    orderBy: [{ createdAt: "desc" }, { email: "asc" }],
    select: { id: true, email: true, status: true, createdAt: true, confirmedAt: true },
  });
}

export function countByStatus(rows: { status: SubscriberStatus }[]): Record<SubscriberStatus, number> {
  const counts: Record<SubscriberStatus, number> = { PENDING: 0, CONFIRMED: 0, UNSUBSCRIBED: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

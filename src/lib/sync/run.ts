import type { SyncRun, SyncSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { drainEmailQueue } from "@/lib/email/queue";
import { getMailer } from "@/lib/email/send";
import { revalidateFor, type RevalidateEvent } from "@/lib/revalidate";
import { copyCounters } from "@/lib/sync/housekeeping";
import { syncLetterboxd } from "@/lib/sync/letterboxd";
import { withSyncRun, type SyncWork } from "@/lib/sync/record-run";
import { syncStatsfm } from "@/lib/sync/statsfm";
import { syncStrava } from "@/lib/sync/strava";

// One entry point for every scheduled job (spec §9.1): the cron routes and the
// dashboard's "Run sync now" both call runSync, and each run is logged.

export type RunSyncOptions = {
  /**
   * true from an admin server action: tags expire at once (`updateTag`), so
   * Zaid sees the result on his next load. The default suits cron route
   * handlers, where only `revalidateTag(tag, 'max')` is allowed.
   */
  immediate?: boolean;
};

/**
 * Housekeeping: Redis counters → PostStat + PostStatDaily, then the new-post
 * email queue. The two are independent, so one failing doesn't skip the other;
 * the run fails if either did. `itemsChanged` = posts whose counts moved + emails sent.
 */
async function housekeeping(): Promise<{ itemsChanged: number; message: string }> {
  const errors: string[] = [];
  let counters = 0;
  try {
    counters = (await copyCounters()).itemsChanged;
  } catch (err) {
    errors.push(`counters: ${err instanceof Error ? err.message : String(err)}`);
  }
  let email = { sent: 0, remaining: 0 };
  try {
    email = await drainEmailQueue(getMailer());
  } catch (err) {
    errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
  const parts = [`${counters} counters changed`, `${email.sent} emails sent`];
  if (email.remaining > 0) parts.push(`${email.remaining} still queued`);
  return { itemsChanged: counters + email.sent, message: parts.join(" · ") };
}

function work(source: SyncSource, { immediate = false }: RunSyncOptions): SyncWork {
  const revalidate = (event: RevalidateEvent) => () => revalidateFor(event, undefined, { immediate });
  switch (source) {
    case "LETTERBOXD":
      return () => syncLetterboxd({ fetch: globalThis.fetch, db, revalidate: revalidate("letterboxd") });
    case "STATSFM":
      return () => syncStatsfm({ fetch: globalThis.fetch, db, revalidate: revalidate("statsfm") });
    case "STRAVA":
      // No fetch passed: the real one, behind the local guard (decision "No real Strava calls locally").
      return () => syncStrava({ db, revalidate: revalidate("strava") });
    case "HOUSEKEEPING":
      return housekeeping;
  }
}

/** Runs one source and logs it. Never throws; the outcome is the returned SyncRun. */
export function runSync(source: SyncSource, options: RunSyncOptions = {}): Promise<SyncRun> {
  return withSyncRun(source, work(source, options));
}

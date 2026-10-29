"use server";

import { z } from "zod";
import { SYNC_SOURCES, type SyncSourceName } from "@/lib/admin/dashboard";
import { requireAdmin } from "@/lib/require-admin";
import { runSync } from "@/lib/sync/run";

// Dashboard actions (spec §7, §9.1). "Run sync now" is a server action, so
// the cron secret never reaches the browser: it calls the sync code directly.

export type RunSyncResult = { ok: boolean; message: string };

/**
 * Runs one source's sync now and logs it like the cron does. Tags expire at
 * once (`updateTag`), so the public pages show the result on the next load.
 * A failed sync isn't thrown: its message comes back for the dashboard.
 */
export async function runSyncNow(source: SyncSourceName): Promise<RunSyncResult> {
  await requireAdmin();
  const parsed = z.enum(SYNC_SOURCES).parse(source);
  const run = await runSync(parsed, { immediate: true });
  return run.ok ? { ok: true, message: `Done · ${run.itemsChanged} changed` } : { ok: false, message: run.message };
}

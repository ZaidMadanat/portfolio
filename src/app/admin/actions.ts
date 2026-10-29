"use server";

import { z } from "zod";
import { SYNC_SOURCES, type SyncSourceName } from "@/lib/admin/dashboard";
import { requireAdmin } from "@/lib/require-admin";

// Dashboard actions (spec §7, §9.1). "Run sync now" is a server action, so
// the cron secret never reaches the browser: it calls the sync code directly.

export type RunSyncResult = { ok: boolean; message: string };

/**
 * Runs one source's sync now. Until Task 32 wires `runSync(source)` in, it
 * only checks the session and the source and reports that.
 */
export async function runSyncNow(source: SyncSourceName): Promise<RunSyncResult> {
  await requireAdmin();
  z.enum(SYNC_SOURCES).parse(source);
  // TODO(Task 32): return runSync(parsed), then the page refreshes to show the new SyncRun.
  return { ok: false, message: "Not wired yet" };
}

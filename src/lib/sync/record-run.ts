import type { SyncRun, SyncSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// The sync run log (spec §9.1: "each run writes a SyncRun row"). The dashboard
// reads the latest row per source. Sync errors are written so their messages
// carry status codes and shapes only, never tokens or response bodies.

export type SyncWork = () => Promise<{ itemsChanged: number; message?: string }>;

const MAX_MESSAGE = 500;

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return (text.trim() || "Sync failed").slice(0, MAX_MESSAGE);
}

/**
 * Runs `fn` between a started row and its outcome: `ok`, `message` (the error's
 * message on failure) and `itemsChanged`. **Never throws**: a failing sync, or
 * a database that can't take the log, comes back as an `ok: false` run.
 */
export async function withSyncRun(source: SyncSource, fn: SyncWork): Promise<SyncRun> {
  const startedAt = new Date();
  let row: SyncRun;
  try {
    row = await db.syncRun.create({ data: { source, startedAt } });
  } catch (err) {
    // No log means no run: the DB the sync would write to is the one that failed.
    console.error(`[sync] ${source}: couldn't start the run log (${err instanceof Error ? err.name : "error"})`);
    return { id: "", source, startedAt, finishedAt: new Date(), ok: false, message: messageOf(err), itemsChanged: 0 };
  }

  let outcome: Pick<SyncRun, "ok" | "message" | "itemsChanged">;
  try {
    const result = await fn();
    outcome = { ok: true, message: (result.message ?? "").slice(0, MAX_MESSAGE), itemsChanged: result.itemsChanged };
  } catch (err) {
    outcome = { ok: false, message: messageOf(err), itemsChanged: 0 };
    console.error(`[sync] ${source} failed: ${outcome.message}`);
  }

  const finished = { ...outcome, finishedAt: new Date() };
  try {
    return await db.syncRun.update({ where: { id: row.id }, data: finished });
  } catch (err) {
    console.error(`[sync] ${source}: couldn't record the outcome (${err instanceof Error ? err.name : "error"})`);
    return { ...row, ...finished };
  }
}

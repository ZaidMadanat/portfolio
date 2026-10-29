"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runSyncNow } from "@/app/admin/actions";
import type { SyncSourceName } from "@/lib/admin/dashboard";

// Daily sync status per source (spec §7): the last run and a "Run sync now"
// button ("Run now" for housekeeping), which calls a server action (the cron
// secret stays on the server).

export type SyncRow = {
  source: SyncSourceName;
  name: string;
  /** true/false for the last run's outcome, null when it has never run. */
  ok: boolean | null;
  /** "Oct 29, 6:00 AM · 3 changed", "Never run", … (formatted on the server). */
  detail: string;
};

const DOT = { ok: "bg-second", failed: "bg-accent", never: "bg-surface" } as const;

export function SyncStatus({ rows }: { rows: SyncRow[] }) {
  const router = useRouter();
  const [running, setRunning] = useState<SyncSourceName | null>(null);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();

  async function run(row: SyncRow) {
    setRunning(row.source);
    setMessage("");
    try {
      const result = await runSyncNow(row.source);
      setMessage(`${row.name}: ${result.message}`);
      // Failed runs are logged too, so the row's status changes either way.
      startTransition(() => router.refresh());
    } catch {
      setMessage(`${row.name}: Couldn't start the sync. Try again.`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Sync status" className="flex flex-col gap-3">
        {rows.map((row) => {
          const state = row.ok === null ? "never" : row.ok ? "ok" : "failed";
          return (
            <li
              key={row.source}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 border-line bg-bg p-3"
            >
              <span aria-hidden="true" className={`size-3 shrink-0 rounded-full border-2 border-ink ${DOT[state]}`} />
              <span className="flex min-w-0 flex-[1_1_12rem] flex-col">
                <span className="font-bold">
                  {row.name}
                  {state === "never" ? null : (
                    <span className={`ml-2 text-sm font-bold ${state === "ok" ? "text-muted" : "text-accent-ink"}`}>
                      {state === "ok" ? "OK" : "Failed"}
                    </span>
                  )}
                </span>
                <span className="text-sm break-words text-muted">{row.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => void run(row)}
                disabled={running !== null}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-ink bg-surface px-3.5 font-bold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running === row.source ? "Running…" : row.source === "HOUSEKEEPING" ? "Run now" : "Run sync now"}{" "}
                <span className="sr-only">for {row.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="min-h-6 font-semibold">
        {message}
      </p>
    </div>
  );
}

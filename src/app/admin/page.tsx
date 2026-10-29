import type { Metadata } from "next";
import Link from "next/link";
import { Drafts } from "@/features/admin/dashboard/Drafts";
import { StatTiles } from "@/features/admin/dashboard/StatTiles";
import { SyncStatus, type SyncRow } from "@/features/admin/dashboard/SyncStatus";
import { getDashboard, SYNC_SOURCE_LABEL, type SyncRunSummary } from "@/lib/admin/dashboard";
import { greeting } from "@/lib/admin/greeting";
import { plural, SITE_TIME_ZONE } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Dashboard" };

// The dashboard (spec §7): greeting, quick-create, stat tiles, drafts with
// Continue, and the daily sync per source with "Run sync now" (a server
// action, so the cron secret never reaches the browser).

// Plain <a>s: /admin/posts/new creates a draft, so a router prefetch must
// never reach it; the review links stay consistent with it.
const QUICK_CREATE = [
  { label: "+ New post", href: "/admin/posts/new", primary: true },
  { label: "+ Food", href: "/admin/reviews/new?kind=FOOD" },
  { label: "+ Film", href: "/admin/reviews/new?kind=FILM" },
  { label: "+ Album", href: "/admin/reviews/new?kind=ALBUM" },
  { label: "+ Concert", href: "/admin/reviews/new?kind=CONCERT" },
];

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: SITE_TIME_ZONE,
});

function runDetail(run: SyncRunSummary | null): string {
  if (!run) return "Never run";
  const at = when.format(run.startedAt);
  if (!run.finishedAt) return `${at} · still running`;
  if (!run.ok) return `${at} · failed${run.message ? `: ${run.message}` : ""}`;
  return `${at} · ${run.itemsChanged} changed`;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const { stats, drafts, sync } = await getDashboard();
  const rows: SyncRow[] = sync.map(({ source, lastRun }) => ({
    source,
    name: SYNC_SOURCE_LABEL[source],
    ok: lastRun ? lastRun.ok : null,
    detail: runDetail(lastRun),
  }));

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-4xl leading-none font-extrabold sm:text-[2.75rem]">{greeting(new Date())}</h1>
          <p className="text-muted">
            {stats.drafts > 0 ? `${plural(stats.drafts, "draft")} waiting.` : "No drafts waiting."}
          </p>
        </div>
        <nav aria-label="Create">
          <ul className="flex flex-wrap gap-2">
            {QUICK_CREATE.map((q) => (
              <li key={q.href}>
                <a
                  href={q.href}
                  className={`inline-flex min-h-11 items-center rounded-2xl border-2 border-ink px-4 font-bold ${
                    q.primary ? "bg-accent font-extrabold text-on-accent shadow-hard" : "bg-surface text-ink hover:bg-soft"
                  }`}
                >
                  {q.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <StatTiles stats={stats} />

      <div className="flex flex-wrap items-start gap-5">
        <Drafts drafts={drafts} total={stats.drafts} />
        <section
          aria-labelledby="sync-heading"
          className="flex min-w-0 flex-[1_1_20rem] flex-col gap-3 rounded-3xl border-2 border-ink bg-surface p-5"
        >
          <h2 id="sync-heading" className="font-display text-2xl font-extrabold">
            Daily sync
          </h2>
          <SyncStatus rows={rows} />
          <p className="text-sm text-muted">Each source runs once a day, then the pages it feeds rebuild.</p>
        </section>
      </div>

      <p className="text-muted">
        Top 4 films and albums for the Reviews hub:{" "}
        <Link
          href="/admin/favourites"
          className="inline-flex min-h-11 items-center font-bold text-accent-ink underline-offset-4 hover:underline"
        >
          edit favourites
        </Link>
      </p>
    </div>
  );
}

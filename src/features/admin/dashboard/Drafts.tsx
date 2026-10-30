import Link from "next/link";
import type { DashboardDraft } from "@/lib/admin/dashboard";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";

// Drafts with Continue (spec §7), most recently edited first.

export function Drafts({ drafts, total }: { drafts: DashboardDraft[]; total: number }) {
  return (
    <section
      aria-labelledby="drafts-heading"
      className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3 rounded-3xl border-2 border-ink bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="drafts-heading" className="font-display text-2xl font-extrabold">
          Drafts
        </h2>
        {total > drafts.length ? (
          <Link
            href="/admin/posts?status=draft"
            className="inline-flex min-h-11 items-center font-bold text-accent-ink underline-offset-4 hover:underline"
          >
            All {total} drafts
          </Link>
        ) : null}
      </div>
      {drafts.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {drafts.map((d) => {
            const title = d.title.trim() || "Untitled draft";
            return (
              <li key={d.id}>
                <Link
                  href={`/admin/posts/${d.id}`}
                  aria-label={`Continue ${title}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 border-line bg-bg p-3.5 hover:border-ink"
                >
                  <span className="flex min-w-0 flex-[1_1_14rem] flex-col">
                    <span className="font-bold break-words">{title}</span>
                    <span className="text-[13px] text-muted">
                      {d.templateName ? `${d.templateName} · ` : ""}edited {formatDate(d.updatedAt, SITE_TIME_ZONE)} ·{" "}
                      {d.readingMinutes} min read
                    </span>
                  </span>
                  <span aria-hidden="true" className="font-bold text-accent-ink">
                    Continue →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">No drafts. Start one with + New post.</p>
      )}
    </section>
  );
}

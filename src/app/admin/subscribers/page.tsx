import type { Metadata } from "next";
import { Pill } from "@/components/ui/Pill";
import { ConfirmAction } from "@/features/admin/ConfirmAction";
import type { SubscriberStatus } from "@/generated/prisma/client";
import { countByStatus, listSubscribers } from "@/lib/admin/subscribers";
import { formatDate, SITE_TIME_ZONE } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import { removeSubscriber } from "./actions";

export const metadata: Metadata = { title: "Subscribers" };

const TONE: Record<SubscriberStatus, "soft2" | "soft" | "outline"> = {
  CONFIRMED: "soft2",
  PENDING: "soft",
  UNSUBSCRIBED: "outline",
};

// Subscribers (spec §7): everyone with their status, a CSV export and a
// remove button. Export is a plain <a> to a route handler (a file download).
export default async function SubscribersPage() {
  await requireAdmin();
  const rows = await listSubscribers();
  const counts = countByStatus(rows);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-extrabold">Subscribers</h1>
          <p className="text-muted">
            {counts.CONFIRMED} confirmed · {counts.PENDING} pending · {counts.UNSUBSCRIBED} unsubscribed
          </p>
        </div>
        <a
          href="/admin/subscribers/export"
          download
          className="inline-flex min-h-11 items-center rounded-2xl border-2 border-ink bg-accent px-5 font-extrabold text-on-accent shadow-hard"
        >
          Export CSV
        </a>
      </div>

      {rows.length > 0 ? (
        // Scrolls sideways inside its box on phones; focusable so the keyboard can scroll it.
        // `relative` keeps the absolutely positioned sr-only text inside the box:
        // without it, it escapes and makes the whole page wider than the phone.
        <div
          role="region"
          aria-label="Subscriber list"
          tabIndex={0}
          className="relative max-w-full overflow-x-auto rounded-3xl border-2 border-ink bg-surface"
        >
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <caption className="sr-only">Subscribers, newest first</caption>
            <thead>
              <tr className="border-b-2 border-ink text-sm">
                <th scope="col" className="px-4 py-3 font-bold">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Signed up
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b-2 border-line align-top last:border-b-0">
                  <td className="px-4 py-3 font-semibold break-all">{s.email}</td>
                  <td className="px-4 py-3">
                    <Pill tone={TONE[s.status]}>{s.status}</Pill>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-muted">
                    {formatDate(s.createdAt, SITE_TIME_ZONE)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ConfirmAction
                      action={removeSubscriber.bind(null, s.id)}
                      label="Remove"
                      ariaLabel={`Remove ${s.email}`}
                      question="Remove this subscriber for good? They won't get any more emails."
                      confirmLabel="Yes, remove"
                      errorMessage="Couldn't remove this subscriber. Reload and try again."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-3xl border-2 border-dashed border-line p-5 text-muted">
          Nobody has subscribed yet.
        </p>
      )}
    </section>
  );
}

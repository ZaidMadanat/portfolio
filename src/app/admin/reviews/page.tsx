import type { Metadata } from "next";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { RatingStamp } from "@/components/ui/RatingStamp";
import { ConfirmAction } from "@/features/admin/ConfirmAction";
import { REVIEW_KINDS } from "@/lib/admin/review-form";
import { listAdminReviews, parseReviewKind } from "@/lib/admin/reviews";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import { REVIEW_KIND_LABEL } from "@/lib/reviews/meta";
import { deleteReview } from "./actions";

export const metadata: Metadata = { title: "Reviews" };

const FILTERS = [{ id: null, label: "All" }, ...REVIEW_KINDS.map((k) => ({ id: k, label: REVIEW_KIND_LABEL[k] }))];

// The reviews list (spec §7 Reviews): every review, newest first, filtered by
// ?kind=, with + New per kind, Edit and Delete. Deleting unlinks a post first,
// so its rating box simply goes away.
export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin();
  const kind = parseReviewKind((await searchParams).kind);
  const { rows, counts } = await listAdminReviews(kind);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold">Reviews</h1>
        <ul aria-label="New review" className="flex flex-wrap gap-2">
          {REVIEW_KINDS.map((k) => (
            <li key={k}>
              <Link
                href={`/admin/reviews/new?kind=${k}`}
                className="inline-flex min-h-11 items-center rounded-2xl border-2 border-ink bg-accent px-4 font-extrabold text-on-accent shadow-hard"
              >
                + {REVIEW_KIND_LABEL[k]}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <nav aria-label="Filter reviews">
        <ul className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = f.id === kind;
            return (
              <li key={f.label}>
                <Link
                  href={f.id ? `/admin/reviews?kind=${f.id}` : "/admin/reviews"}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 font-bold ${
                    on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
                  }`}
                >
                  {f.label}
                  <span className={on ? "text-bg" : "text-muted"}>{counts[f.id ?? "all"]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length > 0 ? (
        <ul aria-label="Reviews" className="flex flex-col gap-3">
          {rows.map((r) => {
            const when = formatDate(r.date);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border-2 border-ink bg-surface p-4">
                <RatingStamp rating={r.rating} size="sm" />
                <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone="soft2">{REVIEW_KIND_LABEL[r.kind]}</Pill>
                    <Link href={`/admin/reviews/${r.id}`} className="font-display text-lg font-bold break-words hover:text-accent-ink">
                      {r.title}
                    </Link>
                  </span>
                  <p className="text-sm break-words text-muted">{[when, r.meta].filter(Boolean).join(" · ")}</p>
                  {r.post ? (
                    <p className="text-sm break-words text-muted">
                      Post:{" "}
                      <Link href={`/admin/posts/${r.post.id}`} className="font-semibold text-ink underline">
                        {r.post.title.trim() || "Untitled draft"}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/reviews/${r.id}`}
                    aria-label={`Edit ${r.title} (${when})`}
                    className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-ink px-3.5 font-semibold text-bg"
                  >
                    Edit
                  </Link>
                  <ConfirmAction
                    action={deleteReview.bind(null, r.id)}
                    label="Delete"
                    ariaLabel={`Delete ${r.title} (${when})`}
                    question={r.post ? "Delete this review? Its post stays, without the rating box." : "Delete this review?"}
                    confirmLabel="Yes, delete it"
                    errorMessage="Couldn't delete the review. Try again."
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold">
            {kind ? `No ${REVIEW_KIND_LABEL[kind].toLowerCase()} reviews yet.` : "No reviews yet."}
          </p>
          <Link
            href={kind ? `/admin/reviews/new?kind=${kind}` : "/admin/reviews/new"}
            className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-accent px-5 font-bold text-on-accent shadow-hard"
          >
            Write the first one
          </Link>
        </div>
      )}
    </section>
  );
}

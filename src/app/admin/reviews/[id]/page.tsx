import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/features/admin/ConfirmAction";
import { ReviewForm } from "@/features/admin/reviews/ReviewForm";
import { getReviewFormOptions, getReviewFormState } from "@/lib/admin/reviews";
import { requireAdmin } from "@/lib/require-admin";
import { deleteReview } from "../actions";

export const metadata: Metadata = { title: "Edit review" };

// Edit a saved review (spec §7 Reviews). `?saved=1` comes from creating it.
// Deleting it here asks first, then goes back to the list.
export default async function EditReviewPage({ params, searchParams }: PageProps<"/admin/reviews/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [state, options, query] = await Promise.all([getReviewFormState(id), getReviewFormOptions(id), searchParams]);
  if (!state) notFound();
  const linked = state.shared.postId !== null;
  return (
    <div className="flex flex-col gap-10">
      <ReviewForm key={id} heading="Edit review" reviewId={id} initial={state} options={options} saved={query.saved === "1"} />
      <section
        aria-labelledby="delete-review-heading"
        className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-line p-5 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <h2 id="delete-review-heading" className="font-display text-xl font-bold">
            Delete this review
          </h2>
          <p className="text-sm text-muted">
            It comes off the public pages straight away. Its photos stay in the library
            {linked ? ", and its post stays, without the rating box." : "."}
          </p>
        </div>
        <ConfirmAction
          action={deleteReview.bind(null, id)}
          label="Delete review"
          ariaLabel="Delete review"
          question={
            linked
              ? "Delete this review? This can't be undone. Its post stays, without the rating box."
              : "Delete this review? This can't be undone."
          }
          confirmLabel="Yes, delete it"
          errorMessage="Couldn't delete the review. Try again."
          redirectTo="/admin/reviews"
        />
      </section>
    </div>
  );
}

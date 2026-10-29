import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/features/admin/reviews/ReviewForm";
import { getReviewFormOptions, getReviewFormState } from "@/lib/admin/reviews";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Edit review" };

// Edit a saved review (spec §7 Reviews). `?saved=1` comes from creating it.
export default async function EditReviewPage({ params, searchParams }: PageProps<"/admin/reviews/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [state, options, query] = await Promise.all([getReviewFormState(id), getReviewFormOptions(id), searchParams]);
  if (!state) notFound();
  return <ReviewForm key={id} heading="Edit review" reviewId={id} initial={state} options={options} saved={query.saved === "1"} />;
}

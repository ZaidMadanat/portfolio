import type { Metadata } from "next";
import { ReviewForm } from "@/features/admin/reviews/ReviewForm";
import { emptyReviewForm } from "@/lib/admin/review-form";
import { getReviewFormOptions, parseReviewKind } from "@/lib/admin/reviews";
import { SITE_TIME_ZONE } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "New review" };

/** Today in Berkeley, `YYYY-MM-DD`. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE }).format(new Date());

// A new review (spec §7 Reviews). `?kind=FOOD|FILM|ALBUM|CONCERT` picks the
// starting tab; anything else starts on Food.
export default async function NewReviewPage({ searchParams }: PageProps<"/admin/reviews/new">) {
  await requireAdmin();
  const kind = parseReviewKind((await searchParams).kind) ?? "FOOD";
  const options = await getReviewFormOptions(null);
  return <ReviewForm heading="New review" reviewId={null} initial={emptyReviewForm(kind, today())} options={options} />;
}

import Link from "next/link";
import type { ReviewKind } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { LatestReview } from "@/lib/queries/reviews";

const KIND: Record<ReviewKind, { label: string; tone: "soft" | "soft2" }> = {
  FOOD: { label: "Food", tone: "soft" },
  FILM: { label: "Film", tone: "soft2" },
  ALBUM: { label: "Album", tone: "soft2" },
  CONCERT: { label: "Concert", tone: "soft" },
};

export function LatestReviews({ items }: { items: LatestReview[] }) {
  return (
    <section aria-labelledby="latest-heading" className="flex flex-col gap-5">
      <h2 id="latest-heading" className="font-display text-3xl font-extrabold sm:text-4xl">
        Latest reviews
      </h2>
      {items.length === 0 ? (
        <EmptyState title="No reviews yet." />
      ) : (
        <ul aria-label="Latest reviews" className="flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card
                as={Link}
                href={r.href}
                lift
                className="flex items-center gap-4 px-5 py-4 sm:px-6"
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <Pill tone={KIND[r.kind].tone} className="tracking-[0.05em] uppercase">
                    {KIND[r.kind].label}
                  </Pill>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-display text-xl font-extrabold">{r.title}</span>
                    {r.meta ? <span className="text-sm text-muted">{r.meta}</span> : null}
                  </span>
                </span>
                <RatingStamp rating={r.rating} size="sm" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

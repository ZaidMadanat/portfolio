import Image from "next/image";
import { Pill } from "@/components/ui/Pill";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { ReviewPreview } from "@/lib/admin/review-form";

// The review form's live preview card (spec §7 Reviews, canvas AdminReview):
// the first photo, kind, title, meta line and rating stamp, as they'll read on
// the site.

export function LivePreview({ preview }: { preview: ReviewPreview }) {
  return (
    <aside aria-label="Live preview" className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 lg:sticky lg:top-6">
      <span aria-hidden="true" className="text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">
        Live preview
      </span>
      <div className="flex flex-col gap-3 rounded-3xl border-3 border-ink bg-surface p-5 shadow-hard-lg">
        {preview.photoUrl ? (
          <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl border-2 border-ink bg-soft">
            <Image src={preview.photoUrl} alt="" fill unoptimized sizes="360px" className="object-cover" />
          </span>
        ) : (
          <span className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-soft font-bold text-muted">
            No photo yet
          </span>
        )}
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Pill tone="soft2" className="self-start tracking-[0.05em] uppercase">
              {preview.kind}
            </Pill>
            <span className="font-display text-[22px] leading-tight font-extrabold break-words">{preview.title}</span>
            {preview.meta ? <span className="text-sm break-words text-muted">{preview.meta}</span> : null}
          </div>
          {preview.rating ? (
            <RatingStamp rating={preview.rating} variant="filled" />
          ) : (
            <span className="inline-flex size-18 shrink-0 -rotate-8 items-center justify-center rounded-full border-2 border-dashed border-ink text-center text-xs font-bold text-muted">
              No rating yet
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

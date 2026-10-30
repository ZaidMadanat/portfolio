import { RatingStamp } from "@/components/ui/RatingStamp";
import { formatDate } from "@/lib/format";
import type { Place } from "@/lib/queries/food";
import { foodMeta } from "@/lib/reviews/meta";

// Every place the filters leave, newest first (spec §6.5). A row is a button:
// choosing it selects its pin on the map and opens the place card.

type Props = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PlaceList({ places, selectedId, onSelect }: Props) {
  return (
    <ul aria-label="Places" className="flex min-w-0 flex-col gap-3">
      {places.map((p) => {
        const on = p.id === selectedId;
        return (
          <li key={p.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(p.id)}
              className={`lift flex w-full min-w-0 cursor-pointer items-center gap-4 rounded-2xl border-2 border-ink px-4 py-3.5 text-left sm:px-5 ${
                on ? "bg-soft shadow-hard" : "bg-surface hover:bg-soft"
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-xl leading-tight font-bold break-words">{p.name}</span>
                <span className="text-[15px] break-words text-muted">{foodMeta(p)}</span>
                <span className="text-sm text-muted">{formatDate(p.date)}</span>
              </span>
              <RatingStamp rating={p.rating} size="sm" variant={p.rating >= 9 ? "filled" : "dashed"} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

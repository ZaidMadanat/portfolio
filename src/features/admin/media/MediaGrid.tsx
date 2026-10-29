"use client";

import Image from "next/image";
import type { MediaItem } from "@/lib/admin/media-library";

// The photo library grid: one button per photo, named by its filename.

type Props = {
  items: MediaItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MediaGrid({ items, selectedId, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((m) => {
        const selected = m.id === selectedId;
        return (
          <li key={m.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={selected}
              aria-label={m.filename}
              onClick={() => onSelect(m.id)}
              className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-[3px] bg-surface text-left text-ink ${
                selected ? "border-ink shadow-hard" : "border-line hover:border-ink"
              }`}
            >
              <span className="relative block aspect-square w-full bg-soft">
                <Image src={m.thumbUrl} alt="" fill unoptimized sizes="240px" className="object-cover" />
              </span>
              <span className="flex items-center justify-between gap-2 px-2.5 py-2 text-[13px] font-semibold">
                <span className="truncate">{m.filename}</span>
                {m.usedIn.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-soft2 px-2 py-0.5 text-[11px] font-bold">In use</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

// "All cuisines ▾" (spec §6.5): a multi-select dropdown with a two-column
// checklist and a count per cuisine. The chosen cuisines show as removable
// chips beside it (FoodExplorer), so this only handles the list.

type Props = {
  options: { name: string; count: number }[];
  selected: string[];
  onChange: (cuisines: string[]) => void;
};

export const FILTER_BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-ink px-4 py-2 font-bold";

function summary(selected: string[]): string {
  if (selected.length === 0) return "All cuisines";
  if (selected.length === 1) return selected[0];
  return `${selected.length} cuisines`;
}

export function CuisineDropdown({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const chosen = new Set(selected);

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  // Keep the option order (base list, then custom), whatever order they were ticked in.
  const toggle = (name: string, on: boolean) =>
    onChange(options.map((o) => o.name).filter((n) => (n === name ? on : chosen.has(n))));

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${FILTER_BUTTON} ${selected.length ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"}`}
      >
        <span className="max-w-[14rem] truncate">{summary(selected)}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 6 4.5 4.5L12.5 6" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-full left-0 z-30 mt-2 flex w-[min(30rem,calc(100vw-2.5rem))] flex-col gap-3 rounded-2xl border-2 border-ink bg-surface p-3 sm:p-4 shadow-hard"
        >
          <div
            role="group"
            aria-label="Cuisines"
            className="grid max-h-[min(26rem,55vh)] grid-cols-2 gap-x-2 overflow-y-auto overscroll-contain"
          >
            {options.map((o) => {
              const on = chosen.has(o.name);
              return (
                <label
                  key={o.name}
                  className={`relative flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-sm sm:text-[15px] hover:bg-soft ${on ? "font-bold" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(o.name, e.target.checked)}
                    className="size-[18px] shrink-0 cursor-pointer accent-second"
                  />
                  <span className="min-w-0 flex-1 hyphens-auto">{o.name}</span>
                  <span className={`shrink-0 text-sm tabular-nums ${o.count ? "text-ink" : "text-muted"}`}>
                    {o.count}
                    <span className="sr-only">{o.count === 1 ? " place" : " places"}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 border-t-2 border-line pt-3">
            <p className="text-sm font-semibold text-muted">{selected.length ? `${selected.length} chosen` : "Any cuisine"}</p>
            <button type="button" onClick={close} className={`${FILTER_BUTTON} bg-ink text-bg`}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

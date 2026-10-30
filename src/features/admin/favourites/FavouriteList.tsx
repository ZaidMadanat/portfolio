"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useRef, useState, type FormEvent } from "react";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { setFavorites } from "@/app/admin/favourites/actions";
import { MAX_FAVOURITES, type FavouriteChoice, type FavouriteItem } from "@/lib/admin/favourite-items";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

// One top-4 list (spec §7 Favourites): drag the handle to reorder (or focus it,
// press Space, move with the arrow keys and press Space again), Swap opens a
// picker, Remove takes one out. Every change is saved straight away with
// setFavorites, which also refreshes the reviews hub.

type Kind = "FILM" | "ALBUM";
type Row = { key: string; item: FavouriteItem };

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-ink px-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-60";
const FIELD = "min-h-11 w-full min-w-0 rounded-xl border-2 border-ink bg-bg px-3 text-ink";
const LABEL = "text-[13px] font-extrabold text-muted";

const COPY = {
  FILM: { heading: "Top 4 films", noun: "film", pick: "Pick a film", empty: "No favourite films yet." },
  ALBUM: { heading: "Top 4 albums", noun: "album", pick: "Pick an album", empty: "No favourite albums yet." },
} as const;

const refKey = (i: FavouriteItem) => i.ref?.filmLogId ?? i.ref?.reviewId ?? null;
const itemName = (i: FavouriteItem) => (i.year ? `${i.title} (${i.year})` : i.title);
/** Same favourite: the same log or review, or the same typed title and artist. */
const sameItem = (a: FavouriteItem, b: FavouriteItem) => {
  const ka = refKey(a);
  const kb = refKey(b);
  if (ka || kb) return ka === kb;
  return a.title.trim().toLowerCase() === b.title.trim().toLowerCase() && (a.artist ?? "").toLowerCase() === (b.artist ?? "").toLowerCase();
};

type Props = { kind: Kind; initial: FavouriteItem[]; choices: FavouriteChoice[] };

export function FavouriteList({ kind, initial, choices }: Props) {
  const copy = COPY[kind];
  const dndId = useId();
  const headingId = useId();
  const [rows, setRows] = useState<Row[]>(() => initial.map((item, i) => ({ key: `r${i + 1}`, item })));
  const [status, setStatus] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ index: number | null } | null>(null);
  const nextKey = useRef(initial.length + 1);
  const saved = useRef<Row[]>(rows);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const moved = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Shows `next` at once and saves it; a failed save puts the last saved list back. */
  function commit(next: Row[]) {
    setRows(next);
    setProblem(null);
    setStatus("Saving…");
    queue.current = queue.current.then(async () => {
      try {
        await setFavorites(kind, next.map((r) => r.item));
        saved.current = next;
        setStatus("Saved.");
      } catch {
        setRows(saved.current);
        setStatus("");
        setProblem(`Couldn't save the ${copy.noun}s. The list is back as it was; try again.`);
      }
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.key === active.id);
    const to = rows.findIndex((r) => r.key === over.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(rows, from, to));
  }

  function choose(item: FavouriteItem) {
    if (!picking) return;
    const row = { key: `r${nextKey.current++}`, item };
    const next = picking.index === null ? [...rows, row] : rows.map((r, i) => (i === picking.index ? row : r));
    setPicking(null);
    commit(next);
  }

  const name = (key: string | number) => {
    const row = rows.find((r) => r.key === key);
    return row ? itemName(row.item) : copy.noun;
  };
  const position = (key: string | number) => rows.findIndex((r) => r.key === key) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      moved.current = false;
      return `Picked up ${name(active.id)}, at position ${position(active.id)} of ${rows.length}.`;
    },
    onDragOver: ({ active, over }) => {
      // Picking up starts "over" itself: keep the pick-up message until it moves.
      if (!over || (over.id === active.id && !moved.current)) return undefined;
      moved.current = true;
      return `${name(active.id)} moved to position ${position(over.id)} of ${rows.length}.`;
    },
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} dropped at position ${position(over.id)} of ${rows.length}.` : `${name(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-[1_1_22rem] flex-col gap-4 rounded-3xl border-2 border-ink bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="font-display text-2xl font-extrabold">
          {copy.heading}
        </h2>
        <p role="status" data-testid="favourites-save-status" className="text-sm font-semibold text-muted">
          {status}
        </p>
      </div>
      {problem ? (
        <p role="alert" className="rounded-2xl border-2 border-accent-ink bg-soft p-3 font-semibold">
          {problem}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable: "To move a favourite, press Space, use the up and down arrow keys, then press Space again to drop it, or Escape to cancel.",
            },
          }}
        >
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            <ol aria-label={copy.heading} className="flex flex-col gap-2.5">
              {rows.map((r, i) => (
                <SortableRow
                  key={r.key}
                  id={r.key}
                  index={i}
                  kind={kind}
                  item={r.item}
                  onSwap={() => setPicking({ index: i })}
                  onRemove={() => commit(rows.filter((x) => x.key !== r.key))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center font-semibold text-muted">{copy.empty}</p>
      )}

      {rows.length < MAX_FAVOURITES ? (
        <button type="button" onClick={() => setPicking({ index: null })} className={`${BUTTON} self-start border-dashed bg-transparent text-ink hover:bg-soft`}>
          + Add a {copy.noun}
        </button>
      ) : null}

      {picking ? (
        <Picker
          kind={kind}
          title={picking.index === null ? copy.pick : `Swap ${itemName(rows[picking.index].item)}`}
          choices={choices}
          taken={rows.filter((_, i) => i !== picking.index).map((r) => r.item)}
          onChoose={choose}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </section>
  );
}

type RowProps = { id: string; index: number; kind: Kind; item: FavouriteItem; onSwap: () => void; onRemove: () => void };

function SortableRow({ id, index, kind, item, onSwap, onRemove }: RowProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    // Rows still follow the pointer or the arrow keys; they just don't glide.
    transition: reducedMotion ? null : undefined,
  });
  const name = itemName(item);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-bg p-2.5 ${isDragging ? "z-10 shadow-hard-lg" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
        className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl border-2 border-ink bg-surface text-ink active:cursor-grabbing"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>
      <span aria-hidden="true" className="w-5 shrink-0 text-center font-display text-lg font-extrabold">
        {index + 1}
      </span>
      <span aria-hidden="true" className="shrink-0">
        {kind === "FILM" ? (
          <span className="block w-10">
            <PosterBlock title={item.title} posterUrl={item.coverUrl} toneIndex={index} />
          </span>
        ) : (
          <AlbumCover coverUrl={item.coverUrl} toneIndex={index} size="sm" />
        )}
      </span>
      <span className="flex min-w-0 flex-[1_1_8rem] flex-col">
        <span className="font-bold break-words" data-testid="favourite-title">
          {item.title}
        </span>
        <span className="text-sm break-words text-muted">{[item.artist, item.year].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={onSwap} aria-label={`Swap ${name}`} className={`${BUTTON} bg-surface text-ink hover:bg-soft`}>
          Swap
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className={`${BUTTON} bg-surface text-ink hover:bg-soft`}>
          Remove
        </button>
      </span>
    </li>
  );
}

type PickerProps = {
  kind: Kind;
  title: string;
  choices: FavouriteChoice[];
  taken: FavouriteItem[];
  onChoose: (item: FavouriteItem) => void;
  onClose: () => void;
};

/** A modal: search the synced choices, or type one in. */
function Picker({ kind, title, choices, taken, onChoose, onClose }: PickerProps) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState({ title: "", artist: "", year: "", coverUrl: "" });
  const [typedError, setTypedError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = choices.filter((c) => !q || c.label.toLowerCase().includes(q));
  const groups = [...new Set(shown.map((c) => c.group))];

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    const t = typed.title.trim();
    const year = typed.year.trim() ? Number(typed.year) : undefined;
    const cover = typed.coverUrl.trim();
    if (!t) return setTypedError("Add a title.");
    if (kind === "ALBUM" && !typed.artist.trim()) return setTypedError("Add the artist.");
    if (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 9999)) return setTypedError("The year should be a number, like 2016.");
    if (cover && !/^https:\/\/\S+$/i.test(cover)) return setTypedError("Use an https:// image link.");
    onChoose({ title: t, ...(typed.artist.trim() ? { artist: typed.artist.trim() } : {}), ...(year ? { year } : {}), ...(cover ? { coverUrl: cover } : {}) });
  }

  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[85dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-3 border-ink bg-surface p-5 text-ink shadow-hard-lg backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 id={`${ids}-title`} className="font-display text-xl font-extrabold break-words">
            {title}
          </h3>
          <button type="button" onClick={onClose} className={`${BUTTON} shrink-0 bg-bg text-ink`}>
            Close
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-search`} className={LABEL}>
            Search
          </label>
          <input id={`${ids}-search`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={FIELD} autoFocus />
        </div>

        {groups.length === 0 ? <p className="text-sm text-muted">Nothing matches. Type it in below.</p> : null}
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-1.5">
            <h4 className={LABEL}>{g}</h4>
            <ul className="flex flex-col gap-1.5">
              {shown
                .filter((c) => c.group === g)
                .map((c) => {
                  const already = taken.some((t) => sameItem(t, c.item));
                  return (
                    <li key={c.key}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => onChoose(c.item)}
                        className="flex min-h-11 w-full cursor-pointer items-center rounded-xl border-2 border-line bg-bg px-3 text-left font-semibold break-words hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {c.label}
                        {already ? <span className="ml-auto pl-2 text-sm text-muted">In the list</span> : null}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}

        <form onSubmit={submitTyped} noValidate className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-ink p-4">
          <h4 className="font-bold">Or type it in</h4>
          <div className="flex flex-wrap gap-3">
            <TypedField id={`${ids}-t`} label="Title" value={typed.title} onValue={(v) => setTyped({ ...typed, title: v })} className="flex-[2_1_12rem]" />
            {kind === "ALBUM" ? (
              <TypedField id={`${ids}-a`} label="Artist" value={typed.artist} onValue={(v) => setTyped({ ...typed, artist: v })} className="flex-[2_1_12rem]" />
            ) : null}
            <TypedField id={`${ids}-y`} label="Year" value={typed.year} onValue={(v) => setTyped({ ...typed, year: v })} className="flex-[1_1_6rem]" inputMode="numeric" />
            <TypedField
              id={`${ids}-c`}
              label="Cover image link (optional)"
              value={typed.coverUrl}
              onValue={(v) => setTyped({ ...typed, coverUrl: v })}
              className="flex-[3_1_14rem]"
            />
          </div>
          {typedError ? (
            <p role="alert" className="text-sm font-semibold text-accent-ink">
              {typedError}
            </p>
          ) : null}
          <button type="submit" className={`${BUTTON} self-start bg-accent text-on-accent shadow-hard`}>
            Use this
          </button>
        </form>
      </div>
    </dialog>
  );
}

function TypedField({
  id,
  label,
  value,
  onValue,
  className,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onValue: (v: string) => void;
  className: string;
  inputMode?: "numeric";
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} value={value} inputMode={inputMode} onChange={(e) => onValue(e.target.value)} className={FIELD} />
    </div>
  );
}

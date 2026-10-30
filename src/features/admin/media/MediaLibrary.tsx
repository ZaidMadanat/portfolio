"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUpload } from "@/features/admin/useUpload";
import type { MediaItem } from "@/lib/admin/media-library";
import { MediaDetail } from "./MediaDetail";
import { MediaGrid } from "./MediaGrid";

// The photo library (spec §7): filters All / In use / Unused, an upload drop
// zone (resized and stripped in the browser by useUpload), the grid and the
// detail panel. Server data comes in as props; after a change the page is
// refreshed from the server.

const FILTERS = [
  { id: "all", label: "All", empty: "No photos yet. Drop one above." },
  { id: "used", label: "In use", empty: "No photos are in use." },
  { id: "unused", label: "Unused", empty: "Every photo is in use." },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const matches = (m: MediaItem, filter: Filter) =>
  filter === "all" || (filter === "used") === m.usedIn.length > 0;

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { error, upload } = useUpload();

  const shown = items.filter((m) => matches(m, filter));
  const selected = items.find((m) => m.id === selectedId) ?? null;
  const refresh = () => startTransition(() => router.refresh());

  async function uploadFiles(files: File[]) {
    let last: string | null = null;
    for (const [i, file] of files.entries()) {
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      const media = await upload(file);
      if (!media) break; // useUpload holds the message
      last = media.id;
    }
    setProgress(null);
    if (last) {
      setFilter("all");
      setSelectedId(last);
      refresh();
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void uploadFiles(files);
  }

  const emptyCopy = FILTERS.find((f) => f.id === filter)!.empty;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold">Photo library</h1>
        <div className="flex flex-wrap gap-1.5" aria-label="Filter photos" role="group">
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-ink px-4 font-bold ${
                  on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-24 cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed px-5 py-6 text-center font-bold has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-second ${
          dragging ? "border-ink bg-soft text-ink" : "border-ink bg-surface text-muted"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) void uploadFiles(files);
          }}
        />
        Drop photos here to upload, or click to choose. They&apos;re resized and stripped of location data.
      </label>
      <p role="status" className="font-semibold">
        {progress}
      </p>
      {error && !progress ? (
        <p role="alert" className="font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {shown.length > 0 ? (
            <MediaGrid items={shown} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <EmptyState title={emptyCopy} onClear={filter === "all" ? undefined : () => setFilter("all")} />
          )}
        </div>
        <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80">
          {selected ? (
            <MediaDetail
              key={selected.id}
              item={selected}
              onSaved={refresh}
              onDeleted={() => {
                setSelectedId(null);
                refresh();
              }}
            />
          ) : items.length > 0 ? (
            <p className="rounded-3xl border-2 border-dashed border-line p-5 text-muted">
              Pick a photo to see its details.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

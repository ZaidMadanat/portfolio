"use client";

import Image from "next/image";
import { useId, useState, type FormEvent } from "react";
import { deleteMedia, updateAlt } from "@/app/admin/media/actions";
import type { MediaItem } from "@/lib/admin/media-library";
import { NOT_USED } from "@/lib/admin/media-labels";
import { formatBytes, formatDate, plural, SITE_TIME_ZONE } from "@/lib/format";

// The photo library's detail panel (spec §7): filename, size, upload date,
// where it's used, editable alt text, Copy link and Delete. Delete is blocked
// while the photo is in use (the server refuses too).

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  item: MediaItem;
  /** Called after the alt text is saved. */
  onSaved: () => void;
  /** Called after the photo is deleted. */
  onDeleted: (id: string) => void;
};

export function MediaDetail({ item, onSaved, onDeleted }: Props) {
  const ids = useId();
  const [alt, setAlt] = useState(item.alt);
  const [busy, setBusy] = useState<"alt" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inUse = item.usedIn.length > 0;

  async function saveAlt(e: FormEvent) {
    e.preventDefault();
    setBusy("alt");
    setMessage("");
    setError(null);
    try {
      const { postsUpdated } = await updateAlt(item.id, alt);
      setMessage(postsUpdated > 0 ? `Alt text saved. ${plural(postsUpdated, "post")} updated.` : "Alt text saved.");
      onSaved();
    } catch {
      setError("Couldn't save the alt text. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    setMessage("");
    setError(null);
    try {
      await navigator.clipboard.writeText(new URL(item.url, window.location.origin).href);
      setMessage("Link copied.");
    } catch {
      setError("Couldn't copy the link.");
    }
  }

  async function remove() {
    setBusy("delete");
    setMessage("");
    setError(null);
    try {
      await deleteMedia(item.id);
      onDeleted(item.id);
    } catch {
      setConfirming(false);
      setError("Couldn't delete this photo. It may be in use now; reload to check.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside
      aria-label="Photo details"
      className="flex min-w-0 flex-col gap-4 rounded-3xl border-2 border-ink bg-surface p-5 shadow-hard"
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-2xl border-2 border-ink bg-soft">
        <Image src={item.thumbUrl} alt={item.alt} fill unoptimized sizes="320px" className="object-cover" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-extrabold break-all">{item.filename}</h2>
        <p className="text-sm text-muted">
          {formatBytes(item.bytes)} · {item.width} × {item.height} · uploaded{" "}
          {formatDate(item.createdAt, SITE_TIME_ZONE)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[13px] font-extrabold text-muted">Used in</h3>
        {inUse ? (
          <ul className="flex flex-col gap-1 font-semibold">
            {item.usedIn.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : (
          <p className="font-semibold">{NOT_USED}</p>
        )}
      </div>

      <form onSubmit={saveAlt} className="flex flex-col gap-2">
        <label htmlFor={`${ids}-alt`} className="text-[13px] font-extrabold text-muted">
          Alt text
        </label>
        <textarea
          id={`${ids}-alt`}
          rows={3}
          maxLength={500}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          aria-describedby={`${ids}-alt-hint`}
          className="resize-y rounded-xl border-2 border-line bg-bg px-3 py-2.5 text-ink focus:border-ink"
        />
        <p id={`${ids}-alt-hint`} className="text-[13px] text-muted">
          Describe the photo for screen readers. Leave it empty if it&apos;s decorative.
        </p>
        <button type="submit" disabled={busy !== null} className={`${BUTTON} self-start border-ink bg-ink text-bg`}>
          Save alt text
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyLink} className={`${BUTTON} border-ink bg-bg text-ink hover:bg-soft`}>
          Copy link
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={inUse || busy !== null}
          aria-describedby={inUse ? `${ids}-in-use` : undefined}
          className={`${BUTTON} border-accent-ink bg-bg text-accent-ink hover:bg-soft`}
        >
          Delete
        </button>
      </div>
      {inUse ? (
        <p id={`${ids}-in-use`} className="text-[13px] text-muted">
          In use, so it can&apos;t be deleted. Remove it from the posts and reviews above first.
        </p>
      ) : null}

      {confirming && !inUse ? (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-accent-ink bg-soft p-3">
          <p className="font-semibold">Delete this photo and every size of it? This can&apos;t be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className={`${BUTTON} border-ink bg-accent text-on-accent`}
            >
              Yes, delete it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${BUTTON} border-ink bg-bg text-ink`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <p role="status" className="text-sm font-semibold">
        {message}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}
    </aside>
  );
}

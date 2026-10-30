"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import type { ReviewKind } from "@/generated/prisma/enums";
import { saveReview, startReviewPost } from "@/app/admin/reviews/actions";
import { useUpload } from "@/features/admin/useUpload";
import {
  pickAlbum,
  pickFilmLog,
  previewOf,
  REVIEW_KINDS,
  toReviewDraft,
  type PhotoRow,
  type ReviewFormState,
  type SharedState,
} from "@/lib/admin/review-form";
import type { ReviewFormOptions } from "@/lib/admin/reviews";
import { REVIEW_KIND_LABEL } from "@/lib/reviews/meta";
import { reviewFieldErrors, reviewInput, type ReviewInput } from "@/lib/reviews/schema";
import { AlbumFields } from "./AlbumFields";
import { ConcertFields } from "./ConcertFields";
import { BUTTON, describedBy, FIELD, FieldMessages, LABEL, type FieldErrors } from "./fields";
import { FilmFields } from "./FilmFields";
import { FoodFields } from "./FoodFields";
import { LivePreview } from "./LivePreview";

// The review form (spec §7 Reviews, canvas AdminReview): tabs Food / Film /
// Album / Concert, the shared fields every kind has (rating 1–10, date,
// photos, linked post), and a live preview. Each tab keeps its own fields, so
// switching tabs loses nothing. The draft is checked with the same zod rules
// the server uses before it's sent; saveReview re-checks and returns field
// errors, which show under each field.

const INVALID = "Some fields need a look before this can be saved.";
const FAILED = "Couldn't save the review. Check your connection and try again.";

type Props = {
  heading: string;
  reviewId: string | null;
  initial: ReviewFormState;
  options: ReviewFormOptions;
  /** Just created: say so once. */
  saved?: boolean;
};

export function ReviewForm({ heading, reviewId, initial, options, saved = false }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState(saved ? "Review saved." : "");
  const [busy, setBusy] = useState<"save" | "post" | null>(null);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const alertRef = useRef<HTMLParagraphElement>(null);

  const setShared = (patch: Partial<SharedState>) => setState((s) => ({ ...s, shared: { ...s.shared, ...patch } }));
  const kind = state.kind;

  function chooseKind(k: ReviewKind) {
    setState((s) => ({ ...s, kind: k }));
    setErrors({});
    setProblem(null);
  }

  function onTabKey(e: KeyboardEvent) {
    const i = REVIEW_KINDS.indexOf(kind);
    const next =
      e.key === "ArrowRight" ? (i + 1) % REVIEW_KINDS.length
      : e.key === "ArrowLeft" ? (i - 1 + REVIEW_KINDS.length) % REVIEW_KINDS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? REVIEW_KINDS.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    chooseKind(REVIEW_KINDS[next]);
    tabs.current[REVIEW_KINDS[next]]?.focus();
  }

  /** Validates and saves. Resolves to the review id, or null with the errors shown. */
  async function save(): Promise<string | null> {
    setStatus("");
    setProblem(null);
    const draft = toReviewDraft(state);
    const checked = reviewInput.safeParse(draft);
    if (!checked.success) {
      setErrors(reviewFieldErrors(checked.error));
      setProblem(INVALID);
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center" }));
      return null;
    }
    try {
      const result = await saveReview(draft as ReviewInput, reviewId ?? undefined);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setProblem(result.message);
        requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center" }));
        return null;
      }
      setErrors({});
      return result.id;
    } catch {
      setProblem(FAILED);
      return null;
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("save");
    const id = await save();
    if (id && !reviewId) {
      router.push(`/admin/reviews/${id}?saved=1`);
      return; // stays busy until the edit page takes over
    }
    if (id) {
      setStatus("Review saved.");
      router.refresh();
    }
    setBusy(null);
  }

  async function writeOneNow() {
    if (busy) return;
    setBusy("post");
    const id = await save();
    if (!id) {
      setBusy(null);
      return;
    }
    try {
      const result = await startReviewPost(id);
      if (result.ok) {
        router.push(`/admin/posts/${result.postId}`);
        return;
      }
      setProblem(result.message);
    } catch {
      setProblem("The review is saved, but the post couldn't be started. Try again.");
    }
    if (!reviewId) router.replace(`/admin/reviews/${id}`);
    setBusy(null);
  }

  const panelId = "review-kind-panel";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold">{heading}</h1>
        <div
          role="tablist"
          aria-label="Review kind"
          onKeyDown={onTabKey}
          className="flex flex-wrap gap-1.5 rounded-2xl border-2 border-ink bg-surface p-1.5"
        >
          {REVIEW_KINDS.map((k) => {
            const on = k === kind;
            return (
              <button
                key={k}
                ref={(el) => {
                  tabs.current[k] = el;
                }}
                id={`review-tab-${k}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={panelId}
                tabIndex={on ? 0 : -1}
                onClick={() => chooseKind(k)}
                className={`min-h-11 cursor-pointer rounded-xl px-[18px] font-extrabold ${on ? "bg-ink text-bg" : "bg-transparent text-ink hover:bg-soft"}`}
              >
                {REVIEW_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <form
          aria-label="Review"
          noValidate
          onSubmit={onSubmit}
          className="flex min-w-0 flex-[999_1_460px] flex-col gap-[18px] rounded-3xl border-2 border-ink bg-surface p-4 sm:p-6"
        >
          {problem ? (
            <p ref={alertRef} role="alert" className="rounded-2xl border-2 border-accent-ink bg-soft p-3 font-semibold text-ink">
              {problem}
            </p>
          ) : null}

          <div id={panelId} role="tabpanel" aria-labelledby={`review-tab-${kind}`}>
            {kind === "FOOD" ? (
              <FoodFields
                value={state.food}
                onChange={(update) => setState((s) => ({ ...s, food: update(s.food) }))}
                errors={errors}
                cuisines={options.cuisines}
              />
            ) : kind === "FILM" ? (
              <FilmFields
                value={state.film}
                logs={options.filmLogs}
                onPick={(log) => setState((s) => pickFilmLog(s, log))}
                onChange={(update) => setState((s) => ({ ...s, film: update(s.film) }))}
                errors={errors}
              />
            ) : kind === "ALBUM" ? (
              <AlbumFields
                value={state.album}
                albums={options.albums}
                onPick={(a) => setState((s) => ({ ...s, album: pickAlbum(s.album, a) }))}
                onChange={(update) => setState((s) => ({ ...s, album: update(s.album) }))}
                errors={errors}
              />
            ) : (
              <ConcertFields
                value={state.concert}
                onChange={(update) => setState((s) => ({ ...s, concert: update(s.concert) }))}
                errors={errors}
              />
            )}
          </div>

          <RatingButtons value={state.shared.rating} onChange={(rating) => setShared({ rating })} error={errors.rating} />

          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
              <label htmlFor="r-date" className={LABEL}>
                Date
              </label>
              <input
                id="r-date"
                type="date"
                value={state.shared.date}
                onChange={(e) => setShared({ date: e.target.value })}
                aria-invalid={errors.date ? true : undefined}
                aria-describedby={describedBy("r-date", errors.date)}
                className={FIELD}
              />
              <FieldMessages id="r-date" error={errors.date} />
            </div>
            <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
              <label htmlFor="r-post" className={LABEL}>
                Full blog post (optional)
              </label>
              <select
                id="r-post"
                value={state.shared.postId ?? ""}
                onChange={(e) => setShared({ postId: e.target.value || null })}
                aria-invalid={errors.postId ? true : undefined}
                aria-describedby={describedBy("r-post", errors.postId)}
                className={FIELD}
              >
                <option value="">None</option>
                {options.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <FieldMessages id="r-post" error={errors.postId} />
              {state.shared.postId ? (
                <a href={`/admin/posts/${state.shared.postId}`} className="self-start font-bold text-accent-ink underline">
                  Open the post
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void writeOneNow()}
                  disabled={busy !== null}
                  className={`${BUTTON} self-start bg-bg text-ink hover:bg-soft`}
                >
                  {busy === "post" ? "Starting the post…" : "Write one now"}
                </button>
              )}
            </div>
          </div>

          <Photos
            photos={state.shared.photos}
            onChange={(update) => setState((s) => ({ ...s, shared: { ...s.shared, photos: update(s.shared.photos) } }))}
            error={errors.photos}
          />

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p role="status" className="mr-auto font-semibold">
              {status}
            </p>
            <button type="submit" disabled={busy !== null} className={`${BUTTON} bg-accent px-5 font-extrabold text-on-accent shadow-hard`}>
              {busy === "save" ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>

        <LivePreview preview={previewOf(state, options.filmLogs)} />
      </div>
    </section>
  );
}

function RatingButtons({ value, onChange, error }: { value: number | null; onChange: (n: number) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span id="r-rating-label" className={LABEL}>
        Rating
      </span>
      <div role="group" aria-labelledby="r-rating-label" aria-describedby={describedBy("r-rating", error)} className="flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(n)}
              className={`size-12 cursor-pointer rounded-full border-2 border-ink font-display text-lg font-extrabold ${
                on ? "bg-accent text-on-accent" : "bg-bg text-ink hover:bg-soft"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <FieldMessages id="r-rating" error={error} />
    </div>
  );
}

/** The photos drop zone: resized and stripped in the browser, then uploaded to the library. */
type PhotosProps = { photos: PhotoRow[]; onChange: (update: (photos: PhotoRow[]) => PhotoRow[]) => void; error?: string };

function Photos({ photos, onChange, error }: PhotosProps) {
  const { error: uploadError, upload } = useUpload();
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function add(files: File[]) {
    for (const [i, file] of files.entries()) {
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      const media = await upload(file);
      if (!media) break; // useUpload holds the message
      onChange((ps) => (ps.some((x) => x.id === media.id) ? ps : [...ps, { id: media.id, url: media.url960 }]));
    }
    setProgress(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void add(files);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>Photos</span>
      {photos.length > 0 ? (
        <ul aria-label="Review photos" className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative flex flex-col items-center gap-1">
              <span className="relative block size-24 overflow-hidden rounded-xl border-2 border-ink bg-soft">
                <Image src={p.url} alt="" fill unoptimized sizes="96px" className="object-cover" />
              </span>
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange((ps) => ps.filter((x) => x.id !== p.id))}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-ink bg-surface px-3 text-[13px] font-bold hover:bg-soft"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex min-h-[110px] cursor-pointer items-center justify-center rounded-[18px] border-2 border-dashed border-ink px-5 py-6 text-center font-bold has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-second ${
          dragging ? "bg-soft text-ink" : "bg-bg text-muted"
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
            if (files.length > 0) void add(files);
          }}
        />
        Drop photos here, or click to choose. They&apos;re resized and stripped of location data.
      </label>
      <p role="status" className="text-sm font-semibold empty:hidden">
        {progress}
      </p>
      {uploadError && !progress ? (
        <p role="alert" className="text-sm font-semibold text-accent-ink">
          {uploadError}
        </p>
      ) : null}
      <FieldMessages id="r-photos" error={error} />
    </div>
  );
}

"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publishPost, savePost, saveAsTemplate, unpublishPost } from "@/app/admin/posts/actions";
import { useUpload } from "@/features/admin/useUpload";
import type { Category, PostStatus } from "@/generated/prisma/enums";
import type { EditorPost, EditorReviewOption, EditorTemplate } from "@/lib/admin/posts";
import { slugify } from "@/lib/slug";
import type { EditorApi } from "./Editor";
import { savedLabel } from "./saved-label";
import { SettingsPanel } from "./SettingsPanel";

// The post editor page (spec §7, canvas AdminEditor): a top bar with the save
// status, Preview and Publish; cover, title and the block editor; and the
// settings panel. Every change autosaves through savePost, 2 seconds after the
// last edit. BlockNote loads client-side only (next/dynamic, ssr:false).

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <p className="py-6 text-muted">Loading the editor…</p>,
});

const AUTOSAVE_MS = 2000;
const UNTITLED = "untitled";

type Fields = {
  title: string;
  category: Category;
  tags: string[];
  reviewId: string | null;
  slug: string;
  /** Once true the slug is sent as typed; until then a draft's slug follows its title. */
  slugTouched: boolean;
  templateId: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
};

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A draft's slug still follows its title when it's the title's slug, maybe with a -2 suffix. */
function followsTitle(post: EditorPost): boolean {
  if (post.everPublished) return false;
  const base = slugify(post.title) || UNTITLED;
  return new RegExp(`^${escapeRe(base)}(-\\d+)?$`).test(post.slug);
}

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-ink px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60";

type Props = { post: EditorPost; templates: EditorTemplate[]; reviews: EditorReviewOption[] };

export function PostEditor({ post, templates: initialTemplates, reviews }: Props) {
  const titleId = useId();
  const [fields, setFields] = useState<Fields>({
    title: post.title,
    category: post.category,
    tags: post.tags,
    reviewId: post.reviewId,
    slug: post.slug,
    slugTouched: !followsTitle(post),
    templateId: post.templateId,
    coverMediaId: post.coverMediaId,
    coverUrl: post.coverUrl,
  });
  const fieldsRef = useRef(fields);
  const blocksRef = useRef<unknown[]>(post.blocks);
  const editorApi = useRef<EditorApi | null>(null);

  const [status, setStatus] = useState<PostStatus>(post.status);
  const [liveSlug, setLiveSlug] = useState(post.slug);
  const [readingMinutes, setReadingMinutes] = useState(post.readingMinutes);
  const [templates, setTemplates] = useState(initialTemplates);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);

  /** Saves now if anything changed (waiting for a save in flight first). Resolves false on failure. */
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    const f = fieldsRef.current;
    const run = (async () => {
      setSaveState("saving");
      try {
        const res = await savePost(post.id, {
          title: f.title,
          blocks: blocksRef.current as Record<string, unknown>[],
          category: f.category,
          tags: f.tags,
          reviewId: f.reviewId,
          slug: f.slugTouched ? f.slug : undefined,
          coverMediaId: f.coverMediaId,
          templateId: f.templateId,
        });
        setReadingMinutes(res.readingMinutes);
        setLiveSlug(res.slug);
        // Show the slug the server settled on (e.g. "-2"), unless it was edited meanwhile.
        if (fieldsRef.current.slug === f.slug && res.slug !== f.slug) {
          fieldsRef.current = { ...fieldsRef.current, slug: res.slug };
          setFields(fieldsRef.current);
        }
        setSavedAt(new Date());
        setSaveState(dirty.current ? "unsaved" : "saved");
        return true;
      } catch {
        dirty.current = true;
        setSaveState("error");
        return false;
      }
    })();
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }, [post.id]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setSaveState("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const update = useCallback(
    (patch: Partial<Fields>) => {
      fieldsRef.current = { ...fieldsRef.current, ...patch };
      setFields(fieldsRef.current);
      schedule();
    },
    [schedule],
  );

  const onBlocks = useCallback(
    (blocks: unknown[]) => {
      blocksRef.current = blocks;
      schedule();
    },
    [schedule],
  );
  const onReady = useCallback((api: EditorApi) => {
    editorApi.current = api;
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15_000);
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", warn);
      // Leaving through the admin nav: save what's pending.
      if (dirty.current) void flush();
    };
  }, [flush]);

  function setTitle(title: string) {
    const f = fieldsRef.current;
    update({ title, ...(f.slugTouched ? {} : { slug: slugify(title) || UNTITLED }) });
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    editorApi.current?.replaceBlocks(t.blocks);
    blocksRef.current = editorApi.current?.getBlocks() ?? t.blocks;
    update({ templateId: t.id, ...(t.category ? { category: t.category } : {}) });
  }

  async function saveTemplate(name: string): Promise<string | null> {
    if (!(await flush())) return "Couldn't save the post first. Try again.";
    try {
      const t = await saveAsTemplate(post.id, name);
      setTemplates((list) => [...list, t]);
      return null;
    } catch {
      return "Couldn't save the template. Try again.";
    }
  }

  async function preview() {
    await flush();
    window.open(`/admin/posts/${post.id}/preview`, "_blank", "noopener");
  }

  async function publish() {
    setNotice("");
    setProblem(null);
    if (!fieldsRef.current.title.trim()) {
      setProblem("Add a title before publishing.");
      return;
    }
    setBusy(true);
    try {
      if (!(await flush())) throw new Error("save failed");
      const { slug } = await publishPost(post.id);
      setStatus("PUBLISHED");
      setLiveSlug(slug);
      fieldsRef.current = { ...fieldsRef.current, slugTouched: true };
      setFields(fieldsRef.current);
      setNotice("Published. It's live now.");
    } catch {
      setProblem("Couldn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setNotice("");
    setProblem(null);
    setBusy(true);
    try {
      await flush();
      await unpublishPost(post.id);
      setStatus("DRAFT");
      setNotice("Unpublished. It's a draft again.");
    } catch {
      setProblem("Couldn't unpublish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const saveText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "unsaved"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Not saved"
          : savedAt
            ? savedLabel(savedAt, now)
            : "Saved";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-line pb-4">
        <Link href="/admin/posts" className="inline-flex min-h-11 items-center font-bold text-muted hover:text-ink">
          ← Posts
        </Link>
        <span className="text-sm text-muted">
          <span data-testid="post-status" className="font-bold text-ink">
            {status === "PUBLISHED" ? "Published" : "Draft"}
          </span>{" "}
          · <span data-testid="save-status">{saveText}</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {status === "PUBLISHED" ? (
            <a
              href={`/blog/${liveSlug}`}
              target="_blank"
              rel="noopener"
              className={`${BUTTON} bg-bg text-ink hover:bg-soft`}
            >
              View post
            </a>
          ) : null}
          <button type="button" onClick={preview} className={`${BUTTON} bg-bg text-ink hover:bg-soft`}>
            Preview
          </button>
          {status === "PUBLISHED" ? (
            <button type="button" onClick={unpublish} disabled={busy} className={`${BUTTON} bg-bg text-ink hover:bg-soft`}>
              Unpublish
            </button>
          ) : (
            <button type="button" onClick={publish} disabled={busy} className={`${BUTTON} bg-accent font-extrabold text-on-accent shadow-hard`}>
              Publish
            </button>
          )}
        </div>
      </div>

      <div role="status" className="font-semibold empty:hidden">
        {notice}
      </div>
      {problem || saveState === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 font-semibold text-accent-ink">
          {problem ?? "Couldn't save your last changes."}
          {saveState === "error" ? (
            <button type="button" onClick={() => void flush()} className={`${BUTTON} min-h-9 bg-bg text-ink`}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CoverField
            url={fields.coverUrl}
            onUploaded={(id, url) => update({ coverMediaId: id, coverUrl: url })}
            onRemove={() => update({ coverMediaId: null, coverUrl: null })}
          />
          <label htmlFor={titleId} className="sr-only">
            Title
          </label>
          {/* A textarea so long titles wrap; Enter never adds a line break. */}
          <textarea
            id={titleId}
            rows={1}
            value={fields.title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Post title"
            maxLength={200}
            className="field-sizing-content w-full resize-none bg-transparent py-2 font-display text-[clamp(2rem,5vw,3rem)] leading-tight font-extrabold text-ink placeholder:text-muted"
          />
          <Editor initialBlocks={post.blocks} onChange={onBlocks} onReady={onReady} />
        </div>

        <div className="w-full shrink-0 xl:sticky xl:top-6 xl:w-80">
          <SettingsPanel
            templates={templates}
            templateId={fields.templateId}
            onApplyTemplate={applyTemplate}
            category={fields.category}
            onCategory={(category) => update({ category })}
            tags={fields.tags}
            onTags={(tags) => update({ tags })}
            reviews={reviews}
            reviewId={fields.reviewId}
            onReview={(reviewId) => update({ reviewId })}
            slug={fields.slug}
            onSlug={(slug) => update({ slug, slugTouched: true })}
            onSlugBlur={() => {
              const clean = slugify(fieldsRef.current.slug) || slugify(fieldsRef.current.title) || UNTITLED;
              if (clean !== fieldsRef.current.slug) update({ slug: clean });
            }}
            readingMinutes={readingMinutes}
            onSaveTemplate={saveTemplate}
          />
        </div>
      </div>
    </div>
  );
}

/** The cover drop zone (spec §7): upload through the photo pipeline, or remove. */
function CoverField({
  url,
  onUploaded,
  onRemove,
}: {
  url: string | null;
  onUploaded: (id: string, url: string) => void;
  onRemove: () => void;
}) {
  const { status, error, upload } = useUpload();
  const [dragging, setDragging] = useState(false);

  async function take(files: File[]) {
    const file = files[0];
    if (!file) return;
    const media = await upload(file);
    if (media) onUploaded(media.id, media.url960);
  }

  if (url) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative aspect-[21/9] overflow-hidden rounded-3xl border-2 border-ink bg-soft">
          <Image src={url} alt="Cover photo" fill unoptimized sizes="(min-width: 1280px) 760px, 100vw" className="object-cover" />
        </div>
        <button type="button" onClick={onRemove} className={`${BUTTON} self-start bg-bg text-ink hover:bg-soft`}>
          Remove cover
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void take(Array.from(e.dataTransfer.files));
        }}
        className={`flex min-h-28 cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed px-5 py-6 text-center font-bold has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-second ${
          dragging ? "border-ink bg-soft text-ink" : "border-line bg-surface text-muted"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void take(files);
          }}
        />
        {status === "uploading" ? "Uploading the cover…" : "Drag a cover photo here, or click to choose one"}
      </label>
      {error ? (
        <p role="alert" className="font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

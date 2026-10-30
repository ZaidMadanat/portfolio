"use client";

import { useId, useState, type FormEvent } from "react";
import type { Category } from "@/generated/prisma/enums";
import type { EditorReviewOption, EditorTemplate } from "@/lib/admin/posts";
import { BLOG_CATEGORIES, categoryFromLabel } from "@/lib/categories";
import { TagInput } from "./TagInput";

// The editor's settings panel (spec §7): Template, Category (fixed list),
// Tags, Linked review, URL slug, Reading time and "Save as a new template".

const FIELD = "min-h-11 w-full rounded-xl border-2 border-ink bg-bg px-3 text-ink";
const LABEL = "text-[13px] font-extrabold text-muted";
const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-ink px-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-60";

const CATEGORY_OPTIONS = BLOG_CATEGORIES.map((label) => ({ label, value: categoryFromLabel(label) }));

type Props = {
  templates: EditorTemplate[];
  templateId: string | null;
  onApplyTemplate: (id: string) => void;
  category: Category;
  onCategory: (c: Category) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
  reviews: EditorReviewOption[];
  reviewId: string | null;
  onReview: (id: string | null) => void;
  slug: string;
  onSlug: (slug: string) => void;
  onSlugBlur: () => void;
  readingMinutes: number;
  /** Resolves to an error message, or null once saved. */
  onSaveTemplate: (name: string) => Promise<string | null>;
};

export function SettingsPanel(props: Props) {
  const ids = useId();
  const [pendingTemplate, setPendingTemplate] = useState<EditorTemplate | null>(null);
  const [naming, setNaming] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    setSavingTemplate(true);
    setProblem(null);
    const error = await props.onSaveTemplate(templateName);
    setSavingTemplate(false);
    if (error) {
      setProblem(error);
      return;
    }
    setMessage(`Saved as the “${templateName.trim()}” template.`);
    setTemplateName("");
    setNaming(false);
  }

  return (
    <aside
      aria-label="Post settings"
      className="flex min-w-0 flex-col gap-5 rounded-3xl border-2 border-ink bg-surface p-5 shadow-hard"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-template`} className={LABEL}>
          Template
        </label>
        <select
          id={`${ids}-template`}
          className={FIELD}
          value={pendingTemplate?.id ?? props.templateId ?? ""}
          onChange={(e) => {
            const t = props.templates.find((x) => x.id === e.target.value);
            setPendingTemplate(t ?? null);
          }}
        >
          <option value="" disabled>
            None
          </option>
          {props.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {pendingTemplate && pendingTemplate.id !== props.templateId ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-accent-ink bg-soft p-3">
            <p className="text-sm font-semibold">
              Replace what&apos;s in the editor with the “{pendingTemplate.name}” template?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${BUTTON} bg-accent text-on-accent`}
                onClick={() => {
                  props.onApplyTemplate(pendingTemplate.id);
                  setPendingTemplate(null);
                }}
              >
                Replace
              </button>
              <button type="button" className={`${BUTTON} bg-bg text-ink`} onClick={() => setPendingTemplate(null)}>
                Keep my text
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-category`} className={LABEL}>
          Category
        </label>
        <select
          id={`${ids}-category`}
          className={FIELD}
          value={props.category}
          onChange={(e) => props.onCategory(e.target.value as Category)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <TagInput tags={props.tags} onChange={props.onTags} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-review`} className={LABEL}>
          Linked review
        </label>
        <select
          id={`${ids}-review`}
          className={FIELD}
          value={props.reviewId ?? ""}
          onChange={(e) => props.onReview(e.target.value || null)}
          aria-describedby={`${ids}-review-hint`}
        >
          <option value="">None</option>
          {props.reviews.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <p id={`${ids}-review-hint`} className="text-[13px] text-muted">
          Linking shows the rating box at the top of the post.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-slug`} className={LABEL}>
          URL
        </label>
        <div className="flex min-h-11 items-center rounded-xl border-2 border-line bg-bg focus-within:border-ink">
          <span className="pl-3 text-sm text-muted" aria-hidden="true">
            /blog/
          </span>
          <input
            id={`${ids}-slug`}
            value={props.slug}
            onChange={(e) => props.onSlug(e.target.value)}
            onBlur={props.onSlugBlur}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={`${ids}-slug-hint`}
            className="min-h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink outline-none"
          />
        </div>
        <p id={`${ids}-slug-hint`} className="text-[13px] text-muted">
          Follows the title until you edit it. Old links keep working after it changes.
        </p>
      </div>

      <p className="flex justify-between text-sm text-muted">
        <span>Reading time</span>
        <strong className="text-ink">{props.readingMinutes} min (auto)</strong>
      </p>

      {naming ? (
        <form onSubmit={saveTemplate} className="flex flex-col gap-2">
          <label htmlFor={`${ids}-template-name`} className={LABEL}>
            Template name
          </label>
          <input
            id={`${ids}-template-name`}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            maxLength={80}
            required
            className="min-h-11 rounded-xl border-2 border-line bg-bg px-3 text-ink focus:border-ink"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={savingTemplate || !templateName.trim()} className={`${BUTTON} bg-ink text-bg`}>
              Save template
            </button>
            <button type="button" className={`${BUTTON} bg-bg text-ink`} onClick={() => setNaming(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className={`${BUTTON} bg-bg text-ink hover:bg-soft`}
          onClick={() => {
            setMessage("");
            setNaming(true);
          }}
        >
          Save as a new template
        </button>
      )}
      <p role="status" className="text-sm font-semibold">
        {message}
      </p>
      {problem ? (
        <p role="alert" className="text-sm font-semibold text-accent-ink">
          {problem}
        </p>
      ) : null}
    </aside>
  );
}

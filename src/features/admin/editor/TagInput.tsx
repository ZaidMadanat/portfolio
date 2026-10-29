"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalizeTags } from "@/lib/admin/post-fields";

// Free-form blog tags (spec §7): add with Enter, a comma or the Add button;
// each tag has a remove button. Stored lower-case, without "#".

type Props = { tags: string[]; onChange: (tags: string[]) => void };

export function TagInput({ tags, onChange }: Props) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add() {
    const next = normalizeTags([...tags, ...draft.split(",")]);
    if (next.length !== tags.length) onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-tag`} className="text-[13px] font-extrabold text-muted">
        Tags
      </label>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags on this post">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-xl bg-soft2 py-1 pr-1 pl-2.5 text-sm font-semibold">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-surface"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-1.5">
        <input
          id={`${id}-tag`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a tag"
          aria-describedby={`${id}-hint`}
          className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-bg px-3 text-ink focus:border-ink"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-ink bg-bg px-3.5 font-bold text-ink hover:bg-soft"
        >
          Add
        </button>
      </div>
      <p id={`${id}-hint`} className="text-[13px] text-muted">
        Blog tags only. Food, film and music belong to reviews.
      </p>
    </div>
  );
}

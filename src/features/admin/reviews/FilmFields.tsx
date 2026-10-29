"use client";

import type { FilmLogOption, FilmState } from "@/lib/admin/review-form";
import { describedBy, FIELD, FieldMessages, LABEL, TextField, type FieldErrors } from "./fields";

// The Film tab (spec §7 Film): pick a synced diary entry (its rating, stars × 2,
// fills the rating buttons and can be changed), or type a film in by hand.

type Props = {
  value: FilmState;
  logs: FilmLogOption[];
  onPick: (log: FilmLogOption | null) => void;
  onChange: (update: (film: FilmState) => FilmState) => void;
  errors: FieldErrors;
};

export function FilmFields({ value, logs, onPick, onChange, errors }: Props) {
  const manual = value.filmLogId === "";
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-film" className={LABEL}>
          Film
        </label>
        <select
          id="r-film"
          value={value.filmLogId}
          onChange={(e) => onPick(logs.find((l) => l.id === e.target.value) ?? null)}
          aria-invalid={errors.filmLogId ? true : undefined}
          aria-describedby={describedBy("r-film", errors.filmLogId, "hint")}
          className={FIELD}
        >
          <option value="">Enter a film by hand</option>
          {logs.map((l) => (
            <option key={l.id} value={l.id} disabled={l.reviewed}>
              {l.label}
            </option>
          ))}
        </select>
        <FieldMessages
          id="r-film"
          error={errors.filmLogId}
          hint={
            logs.length === 0
              ? "No diary entries yet. Type the film in instead."
              : "Picking an entry fills in its rating (stars × 2). Change it below if you've changed your mind."
          }
        />
      </div>

      {manual ? (
        <div className="flex flex-wrap gap-4">
          <TextField
            id="r-film-title"
            label="Title"
            value={value.title}
            onValue={(v) => onChange((f) => ({ ...f, title: v }))}
            error={errors.title}
            className="flex-[3_1_14rem]"
          />
          <TextField
            id="r-film-year"
            label="Year"
            inputMode="numeric"
            value={value.year}
            onValue={(v) => onChange((f) => ({ ...f, year: v }))}
            error={errors.year}
            className="flex-[1_1_7rem]"
          />
        </div>
      ) : errors.title ? (
        <FieldMessages id="r-film-title" error={errors.title} />
      ) : null}
    </div>
  );
}

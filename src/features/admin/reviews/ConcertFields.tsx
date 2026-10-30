"use client";

import type { ConcertState } from "@/lib/admin/review-form";
import { describedBy, FIELD, FieldMessages, LABEL, TextField, type FieldErrors } from "./fields";

// The Concert tab (spec §7 Concert): artist, venue and a highlight. The date
// is the shared one below.

type Props = {
  value: ConcertState;
  onChange: (update: (concert: ConcertState) => ConcertState) => void;
  errors: FieldErrors;
};

export function ConcertFields({ value, onChange, errors }: Props) {
  const set = (key: keyof ConcertState) => (v: string) => onChange((c) => ({ ...c, [key]: v }));
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-4">
        <TextField id="r-artist" label="Artist" value={value.artist} onValue={set("artist")} error={errors.artist} className="flex-[1_1_14rem]" />
        <TextField id="r-venue" label="Venue" value={value.venue} onValue={set("venue")} error={errors.venue} className="flex-[1_1_14rem]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-highlight" className={LABEL}>
          Highlight (optional)
        </label>
        <textarea
          id="r-highlight"
          rows={2}
          value={value.highlight}
          onChange={(e) => set("highlight")(e.target.value)}
          aria-invalid={errors.highlight ? true : undefined}
          aria-describedby={describedBy("r-highlight", errors.highlight)}
          className={`${FIELD} py-2.5`}
        />
        <FieldMessages id="r-highlight" error={errors.highlight} />
      </div>
    </div>
  );
}

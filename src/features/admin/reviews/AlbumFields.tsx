"use client";

import type { AlbumOption, AlbumState } from "@/lib/admin/review-form";
import { FIELD, FieldMessages, LABEL, TextField, type FieldErrors } from "./fields";

// The Album tab (spec §7 Album): pick one of this week's top albums, or type
// one in. Picking fills the fields below, which stay editable.

type Props = {
  value: AlbumState;
  albums: AlbumOption[];
  onPick: (album: AlbumOption | null) => void;
  onChange: (update: (album: AlbumState) => AlbumState) => void;
  errors: FieldErrors;
};

export function AlbumFields({ value, albums, onPick, onChange, errors }: Props) {
  const set = (key: keyof AlbumState) => (v: string) => onChange((a) => ({ ...a, [key]: v }));
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-album" className={LABEL}>
          Album
        </label>
        <select
          id="r-album"
          value={value.listenId}
          onChange={(e) => onPick(albums.find((a) => a.id === e.target.value) ?? null)}
          aria-describedby="r-album-hint"
          className={FIELD}
        >
          <option value="">Enter an album by hand</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} · {a.artist}
            </option>
          ))}
        </select>
        <FieldMessages
          id="r-album"
          hint={albums.length === 0 ? "Nothing from this week's listening yet. Type the album in." : "This week's most-played albums."}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <TextField id="r-album-title" label="Title" value={value.title} onValue={set("title")} error={errors.title} className="flex-[2_1_14rem]" />
        <TextField id="r-album-artist" label="Artist" value={value.artist} onValue={set("artist")} error={errors.artist} className="flex-[2_1_14rem]" />
      </div>
      <div className="flex flex-wrap gap-4">
        <TextField
          id="r-album-year"
          label="Year"
          inputMode="numeric"
          value={value.year}
          onValue={set("year")}
          error={errors.year}
          className="flex-[1_1_7rem]"
        />
        <TextField
          id="r-album-cover"
          label="Cover image link (optional)"
          type="url"
          value={value.coverUrl}
          onValue={set("coverUrl")}
          error={errors.coverUrl}
          className="flex-[3_1_14rem]"
        />
      </div>
    </div>
  );
}

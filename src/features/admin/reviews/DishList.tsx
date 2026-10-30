"use client";

import { addDish, markMustOrder, removeDish, renameDish, type DishRow } from "@/lib/admin/review-form";
import { FIELD, FieldMessages, LABEL } from "./fields";

// "What I ordered" (spec §7 Food): add and remove dishes, and pick exactly one
// must-order. The rules live in review-form.ts; removing the must-order dish
// hands it to the first one left.

type Props = {
  dishes: DishRow[];
  onChange: (update: (dishes: DishRow[]) => DishRow[]) => void;
  error?: string | null;
};

export function DishList({ dishes, onChange, error }: Props) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={error ? "dishes-error" : undefined}>
      <legend className={`${LABEL} mb-2`}>What I ordered (pick the must-order)</legend>
      {dishes.length === 0 ? <p className="text-sm text-muted">No dishes yet.</p> : null}
      <ul className="flex flex-col gap-2">
        {dishes.map((d, i) => {
          const name = d.name.trim() || `dish ${i + 1}`;
          return (
            <li
              key={d.key}
              className={`relative flex flex-wrap items-center gap-2 rounded-xl border-2 bg-bg p-2 ${d.mustOrder ? "border-ink" : "border-line"}`}
            >
              <label htmlFor={`dish-${d.key}`} className="sr-only">
                Dish {i + 1}
              </label>
              <input
                id={`dish-${d.key}`}
                value={d.name}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange((ds) => renameDish(ds, d.key, value));
                }}
                placeholder="Dish name"
                className={`${FIELD} flex-[1_1_10rem] bg-surface`}
              />
              <button
                type="button"
                aria-pressed={d.mustOrder}
                aria-label={`Must order: ${name}`}
                onClick={() => onChange((ds) => markMustOrder(ds, d.key))}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-ink px-3.5 text-[13px] font-extrabold ${
                  d.mustOrder ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
                }`}
              >
                Must order
              </button>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange((ds) => removeDish(ds, d.key))}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-ink bg-surface px-3 text-[13px] font-bold text-ink hover:bg-soft"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange(addDish)}
        className="inline-flex min-h-11 cursor-pointer items-center self-start rounded-xl border-2 border-dashed border-ink bg-transparent px-4 font-bold text-ink hover:bg-soft"
      >
        + Add dish
      </button>
      <FieldMessages id="dishes" error={error} />
    </fieldset>
  );
}

"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

// Small building blocks shared by the review form's tabs: a labelled text
// input with its error and hint, and the class names the canvas uses.

export const FIELD =
  "min-h-11 w-full min-w-0 rounded-xl border-2 border-ink bg-bg px-3 text-ink aria-[invalid=true]:border-accent-ink";
export const LABEL = "text-[13px] font-extrabold text-muted";
export const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-ink px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60";

export type FieldErrors = Record<string, string>;

/** The ids an input points at with aria-describedby: its error and hint, when shown. */
export function describedBy(id: string, error?: string | null, hint?: ReactNode): string | undefined {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

export function FieldMessages({ id, error, hint }: { id: string; error?: string | null; hint?: ReactNode }) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}
    </>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  id: string;
  label: string;
  value: string;
  onValue: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
};

/** A labelled input. `className` sizes the wrapper (e.g. a flex basis). */
export function TextField({ id, label, value, onValue, error, hint, className = "", ...input }: TextFieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={FIELD}
        {...input}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

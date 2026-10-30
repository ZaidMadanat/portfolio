"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// A destructive admin button with an inline "are you sure?" step. `action` is
// a server action (bound to its row's id by the server page); after it runs
// the page is refreshed from the server, or, with `redirectTo`, left for that
// page (the thing it was about is gone).

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  action: () => Promise<void>;
  /** The button's visible text, e.g. "Remove". */
  label: string;
  /** Its accessible name, naming the row, e.g. "Remove a@example.com". */
  ariaLabel: string;
  question: string;
  confirmLabel: string;
  errorMessage: string;
  /** Go here once the action has run, instead of refreshing this page. */
  redirectTo?: string;
};

export function ConfirmAction({ action, label, ariaLabel, question, confirmLabel, errorMessage, redirectTo }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (redirectTo) {
          router.push(redirectTo);
          return;
        }
        setConfirming(false);
        router.refresh();
      } catch {
        // Server-action errors are generic in production: show our own copy.
        setError(errorMessage);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setConfirming(true)}
        className={`${BUTTON} border-ink bg-surface text-ink hover:bg-soft`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-accent-ink bg-soft p-3">
      <p className="font-semibold">{question}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run} disabled={pending} className={`${BUTTON} border-ink bg-accent text-on-accent`}>
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className={`${BUTTON} border-ink bg-bg text-ink`}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="font-semibold text-accent-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { type FormEvent, useId, useState } from "react";
import { type SubscribeState, SUBSCRIBE_STATES } from "./subscribe-states";

type Props = { variant: "banner" | "box" };

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done" | "error"; message: string };

const result = (state: SubscribeState): Status => ({
  kind: SUBSCRIBE_STATES[state].ok ? "done" : "error",
  message: SUBSCRIBE_STATES[state].banner,
});

/** Maps the /api/subscribe response: 200 {status: "pending" | "already"}, 400 invalid, 429 busy. */
async function statusFor(res: Response): Promise<Status> {
  if (res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const state = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
    return result(state === "already" ? "already" : "pending");
  }
  if (res.status === 400 || res.status === 422) return result("invalid-email");
  if (res.status === 429) return result("busy");
  return result("error");
}

const INPUT =
  "min-h-13 min-w-0 flex-[1_1_220px] rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-ink placeholder:text-muted";
const BUTTON =
  "min-h-13 cursor-pointer rounded-2xl border-2 border-ink bg-accent px-6 py-3 font-extrabold text-on-accent shadow-hard disabled:cursor-wait";

// With JS: fetch JSON {email}, show the result inline. Without JS the form
// posts form-encoded `email` and /api/subscribe redirects to /subscribed.
export function SubscribeBanner({ variant }: Props) {
  const id = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(await statusFor(res));
    } catch {
      setStatus(result("error"));
    }
  }

  const sending = status.kind === "sending";
  const fields = (
    <div className="flex flex-wrap gap-2.5">
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      <input
        id={`${id}-email`}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className={INPUT}
      />
      <button type="submit" disabled={sending} className={BUTTON}>
        {sending ? "Subscribing…" : "Subscribe"}
      </button>
    </div>
  );
  const message = (
    <p
      role="status"
      className={`min-h-6 text-sm font-semibold ${status.kind === "error" ? "text-accent-ink" : "text-ink"}`}
    >
      {status.kind === "done" || status.kind === "error" ? status.message : ""}
    </p>
  );

  if (variant === "box") {
    return (
      <section aria-labelledby={`${id}-heading`}>
        <form
          action="/api/subscribe"
          method="post"
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-3xl border-2 border-ink bg-soft p-6"
        >
          <h2 id={`${id}-heading`} className="font-display text-2xl font-extrabold">
            Liked this? Get the next one by email.
          </h2>
          {fields}
          <p className="text-sm text-muted">
            Unsubscribe any time, or{" "}
            <a href="/rss.xml" className="font-semibold text-accent-ink underline underline-offset-2">
              follow the RSS feed
            </a>
            .
          </p>
          {message}
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <form
        action="/api/subscribe"
        method="post"
        onSubmit={onSubmit}
        className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-4xl border-3 border-ink bg-soft p-6 shadow-hard-lg sm:px-10 sm:py-9"
      >
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          <h2 id={`${id}-heading`} className="font-display text-3xl leading-tight font-extrabold">
            Get new posts by email
          </h2>
          <a
            href="/rss.xml"
            className="inline-flex min-h-11 items-center self-start font-semibold text-accent-ink underline underline-offset-2"
          >
            Or follow the RSS feed
          </a>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2">
          {fields}
          {message}
        </div>
      </form>
    </section>
  );
}

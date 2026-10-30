"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { signInErrorMessage } from "./sign-in-messages";

type Props = {
  /** A GitHub OAuth app is configured on this server. */
  github: boolean;
  /** E2E_AUTH=1: show the email+password form for the e2e test accounts. */
  e2e: boolean;
  /** Error code from a failed GitHub round trip (`?error=`). */
  initialError: string | null;
};

const BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink px-5 py-2.5 font-bold disabled:opacity-60";
const INPUT = "min-h-11 w-full rounded-xl border-2 border-ink bg-surface px-3 text-ink";

export function SignInPanel({ github, e2e, initialError }: Props) {
  const router = useRouter();
  const [error, setError] = useState(() => signInErrorMessage(initialError));
  const [pending, setPending] = useState(false);

  async function withGithub() {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.social({
      provider: "github",
      callbackURL: "/admin",
      errorCallbackURL: "/admin/sign-in",
    });
    // On success the browser is already on its way to GitHub.
    if (res.error) {
      setError(signInErrorMessage(res.error.code ?? "error"));
      setPending(false);
    }
  }

  async function withTestAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (res.error) {
      setError(signInErrorMessage(res.error.code ?? "error"));
      setPending(false);
      return;
    }
    // refresh() so the admin layout renders with the new session cookie.
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-xl border-2 border-ink bg-soft px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={withGithub}
          disabled={pending || !github}
          className={`${BUTTON} bg-ink text-bg`}
        >
          Sign in with GitHub
        </button>
        {github ? null : <p className="text-sm text-muted">GitHub sign-in isn&apos;t set up on this server yet.</p>}
      </div>

      {e2e ? (
        <form
          aria-label="Test sign-in"
          onSubmit={withTestAccount}
          className="flex flex-col gap-3 border-t-2 border-line pt-5"
        >
          <p className="text-sm text-muted">Test accounts (E2E_AUTH only).</p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Email
            <input name="email" type="email" autoComplete="username" required className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Password
            <input name="password" type="password" autoComplete="current-password" required className={INPUT} />
          </label>
          <button type="submit" disabled={pending} className={`${BUTTON} bg-surface text-ink hover:bg-soft`}>
            Sign in with test account
          </button>
        </form>
      ) : null}
    </div>
  );
}

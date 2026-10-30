"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Shown in place of an empty "My top 4" section, to the signed-in admin only.
// /reviews is static, so the check runs in the browser (/api/admin/session)
// and visitors get nothing: no prompt, no layout shift.

const COPY = {
  film: { empty: "No top 4 films yet." },
  album: { empty: "No top 4 albums yet." },
} as const;

export function TopFourAdminPrompt({ kind }: { kind: "film" | "album" }) {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { admin?: unknown } | null) => {
        if (live && body?.admin === true) setAdmin(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!admin) return null;
  return (
    <section className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-ink p-6">
      <p className="font-display text-2xl font-bold">{COPY[kind].empty}</p>
      <Link
        href="/admin/favourites"
        className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-accent px-5 font-bold text-on-accent shadow-hard"
      >
        Pick your top 4 in the admin
        <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </section>
  );
}

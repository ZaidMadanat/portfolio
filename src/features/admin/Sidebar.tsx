"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { authClient } from "@/lib/auth-client";
import { ADMIN_NAV, isActiveAdminPath } from "./nav";

// Left sidebar from md up; a top block with wrapping pills on phones.
export function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    // refresh() drops the client router cache, so Back can't show admin pages.
    router.replace("/admin/sign-in");
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-5 border-b-2 border-ink bg-surface px-4 py-5 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r-2 md:border-b-0 md:px-5 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-extrabold"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-10 -rotate-6 items-center justify-center rounded-xl border-2 border-ink bg-accent text-on-accent shadow-hard"
          >
            ZM
          </span>
          Admin
        </Link>
        <ThemeToggle />
      </div>

      <nav aria-label="Admin">
        <ul className="flex flex-wrap gap-1.5 md:flex-col md:gap-1">
          {ADMIN_NAV.map(({ label, href }) => {
            const active = isActiveAdminPath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold md:rounded-xl ${
                    active ? "border-ink bg-ink text-bg" : "border-transparent text-ink hover:border-ink hover:bg-soft"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-2 text-sm md:mt-auto">
        <p className="text-muted">
          Signed in as <span className="font-semibold text-ink">{name}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-3.5 font-semibold hover:bg-soft"
          >
            View site
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-3.5 font-semibold hover:bg-soft disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

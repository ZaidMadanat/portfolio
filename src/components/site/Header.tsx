import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

// Mobile: mark and theme toggle share the top row, the pills wrap below.
// sm and up: one row, with the toggle at the end of the nav.
export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-4 px-4 py-5 sm:px-6">
      <Link
        href="/"
        // The name starts with the visible "ZM" (WCAG 2.5.3, label in name), so
        // "click ZM" works with voice control.
        aria-label="ZM, Zaid Madanat, home"
        className="wiggle order-1 mr-auto inline-flex size-11 -rotate-6 items-center justify-center rounded-xl border-2 border-ink bg-accent font-display text-lg font-extrabold text-on-accent shadow-hard"
      >
        ZM
      </Link>
      <nav aria-label="Main" className="order-3 w-full sm:order-2 sm:w-auto">
        <ul className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <NavLinks />
        </ul>
      </nav>
      <div className="order-2 sm:order-3">
        <ThemeToggle />
      </div>
    </header>
  );
}

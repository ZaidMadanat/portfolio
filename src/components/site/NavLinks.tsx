"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: "Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(({ label, href }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border-2 border-ink px-3.5 text-sm font-semibold sm:px-4 ${
                active ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

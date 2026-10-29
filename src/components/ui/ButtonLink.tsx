import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  variant: "primary" | "outline" | "ink";
  children: ReactNode;
  className?: string;
};

const VARIANTS = {
  primary: "border-ink bg-accent text-on-accent shadow-hard",
  outline: "border-ink text-ink hover:bg-soft",
  ink: "border-ink bg-ink text-bg",
} as const;

export function ButtonLink({ href, variant, children, className = "" }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 px-5 py-2.5 text-center font-bold ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

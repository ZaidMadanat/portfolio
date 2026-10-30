import type { ReactNode } from "react";

type PillProps = {
  children: ReactNode;
  tone?: "ink" | "soft" | "soft2" | "outline";
  className?: string;
};

const TONES = {
  ink: "border-ink bg-ink text-bg",
  soft: "border-transparent bg-soft text-ink",
  soft2: "border-transparent bg-soft2 text-ink",
  outline: "border-ink text-ink",
} as const;

export function Pill({ children, tone = "soft", className = "" }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 px-3 py-1 text-[13px] font-bold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

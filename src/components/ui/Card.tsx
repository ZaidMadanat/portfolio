import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";

type CardProps<T extends ElementType> = {
  as?: T;
  /** Degrees; spec §5 keeps cards within ±0.5–2. */
  tilt?: number;
  lift?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

// Tilt goes through the `rotate` property via --tilt, so the `lift` hover
// transform in motion.css stacks on top of it.
export function Card<T extends ElementType = "div">({
  as,
  tilt,
  lift = false,
  className = "",
  children,
  style,
  ...rest
}: CardProps<T>) {
  const Tag: ElementType = as ?? "div";
  const tilted = tilt !== undefined && tilt !== 0;
  return (
    <Tag
      {...rest}
      style={tilted ? ({ ...style, "--tilt": `${tilt}deg` } as CSSProperties) : style}
      className={`rounded-3xl border-2 border-ink bg-surface text-ink shadow-hard ${tilted ? "rotate-(--tilt)" : ""} ${lift ? "lift" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

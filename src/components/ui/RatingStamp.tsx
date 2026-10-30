type RatingStampProps = {
  rating: number;
  size?: "sm" | "md" | "lg";
  variant?: "dashed" | "filled";
  /** Big number over a small "out of 10" caption, for the post rating box. */
  label?: boolean;
};

const SIZES = {
  sm: "size-12 border-2 text-sm",
  md: "size-18 border-2 text-lg",
  lg: "size-28 border-3 text-3xl",
} as const;

const VARIANTS = {
  dashed: "border-dashed bg-soft text-ink",
  filled: "bg-accent text-on-accent",
} as const;

// Rotation uses the `rotate` property (not `transform`), so the wiggle
// keyframes in motion.css add to the tilt instead of replacing it.
export function RatingStamp({ rating, size = "md", variant = "dashed", label = false }: RatingStampProps) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 10`}
      className={`wiggle inline-flex shrink-0 -rotate-8 flex-col items-center justify-center rounded-full border-ink font-display leading-none font-extrabold ${SIZES[size]} ${VARIANTS[variant]}`}
    >
      {label ? (
        <>
          <span>{rating}</span>
          <span className="mt-1 font-body text-xs font-bold">out of 10</span>
        </>
      ) : (
        `${rating}/10`
      )}
    </span>
  );
}

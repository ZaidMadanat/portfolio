import Image from "next/image";

type PosterBlockProps = {
  title: string;
  posterUrl?: string | null;
  toneIndex: number;
};

// ink, accent, second, soft2, soft (canvas Film board order).
const TONES = [
  "bg-ink text-bg",
  "bg-accent text-on-accent",
  "bg-second text-on-second",
  "bg-soft2 text-ink",
  "bg-soft text-ink",
] as const;

export function toneAt<T>(tones: readonly T[], index: number): T {
  const n = tones.length;
  return tones[((Math.trunc(index) % n) + n) % n];
}

const FRAME = "@container relative aspect-2/3 w-full overflow-hidden rounded-2xl border-3 border-ink";

// Fills its parent's width; the parent sets the size. The fallback title
// scales with that width through container units. Those units resolve against
// an ancestor container, so they sit on the inner span, never on the frame
// (on the frame they would fall back to the viewport width).
export function PosterBlock({ title, posterUrl, toneIndex }: PosterBlockProps) {
  if (posterUrl) {
    return (
      <div className={`${FRAME} bg-soft`}>
        <Image
          src={posterUrl}
          alt={title}
          fill
          unoptimized
          sizes="(min-width: 640px) 260px, 50vw"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={title}
      className={`${FRAME} font-display leading-[1.05] font-extrabold break-words uppercase ${toneAt(TONES, toneIndex)}`}
    >
      <span className="absolute inset-0 flex items-end p-[7cqw] text-[11cqw]">
        <span className="min-w-0">{title}</span>
      </span>
    </div>
  );
}

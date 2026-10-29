import Image from "next/image";
import { toneAt } from "./PosterBlock";

type AlbumCoverProps = {
  coverUrl?: string | null;
  toneIndex: number;
  /** sm 56 px, md 80 px, fill = parent width. */
  size: "sm" | "md" | "fill";
};

const SIZES = {
  sm: "size-14 rounded-xl border-2",
  md: "size-20 rounded-xl border-2",
  fill: "aspect-square w-full rounded-2xl border-3",
} as const;

const PX = { sm: "56px", md: "80px", fill: "(min-width: 640px) 220px, 50vw" } as const;

// Cover background and record colour pairs, from the canvas Music board.
const TONES = [
  ["bg-second", "bg-accent"],
  ["bg-accent", "bg-ink"],
  ["bg-ink", "bg-second"],
  ["bg-soft", "bg-accent"],
  ["bg-soft2", "bg-second"],
  ["bg-accent", "bg-bg"],
] as const;

// Decorative: the album title and artist always sit next to the cover.
export function AlbumCover({ coverUrl, toneIndex, size }: AlbumCoverProps) {
  const frame = `relative shrink-0 overflow-hidden border-ink ${SIZES[size]}`;
  if (coverUrl) {
    return (
      <div className={`${frame} bg-soft`}>
        <Image src={coverUrl} alt="" fill unoptimized sizes={PX[size]} className="object-cover" />
      </div>
    );
  }
  const [bg, disc] = toneAt(TONES, toneIndex);
  return (
    <div aria-hidden="true" className={`${frame} ${bg}`}>
      <span className={`absolute inset-[15%] rounded-full ${disc}`} />
      <span className="absolute inset-[44%] rounded-full bg-bg" />
    </div>
  );
}

import type { CSSProperties } from "react";
import { AlbumCover } from "@/components/ui/AlbumCover";
import type { RotationAlbum } from "@/lib/queries/music";

const TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5];

// The top albums of the last 7 days (spec §6.7). The page leaves the whole
// section out when there are none, so this always has albums.
export function OnRotation({ albums, id, headingId }: { albums: RotationAlbum[]; id: string; headingId: string }) {
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-6 flex-col gap-6">
      <h2 id={headingId} className="font-display text-3xl font-extrabold sm:text-4xl">
        On rotation this week
      </h2>
      <ul aria-label="On rotation this week" className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {albums.map((album, i) => (
          <li key={album.id} className="flex min-w-0 flex-col gap-2">
            <div
              style={{ "--tilt": `${TILTS[i % TILTS.length]}deg` } as CSSProperties}
              className="tilt-ease rotate-(--tilt)"
            >
              <AlbumCover coverUrl={album.coverUrl} toneIndex={i} size="fill" />
            </div>
            <span className="mt-1 leading-snug font-bold break-words">{album.title}</span>
            <span className="text-sm text-muted break-words">{album.artist}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

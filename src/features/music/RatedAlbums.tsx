import Link from "next/link";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { RatingStamp } from "@/components/ui/RatingStamp";
import type { RatedAlbum } from "@/lib/queries/music";

// ALBUM reviews, best first (spec §6.7). "Read review →" only when a post is linked.
export function RatedAlbums({ albums, id, headingId }: { albums: RatedAlbum[]; id: string; headingId: string }) {
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-6 flex-col gap-6">
      <h2 id={headingId} className="font-display text-3xl font-extrabold sm:text-4xl">
        Rated albums
      </h2>
      <ol aria-label="Rated albums" className="flex flex-col gap-3">
        {albums.map((album, i) => (
          <li
            key={album.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] border-2 border-ink bg-surface px-4 py-3.5 text-ink sm:px-5"
          >
            <span aria-hidden="true" className="w-7 font-display text-xl font-extrabold text-muted">
              {i + 1}
            </span>
            <AlbumCover coverUrl={album.coverUrl} toneIndex={i} size="sm" />
            <div className="flex min-w-0 flex-[1_1_10rem] flex-col">
              <h3 className="font-display text-lg leading-tight font-extrabold break-words">{album.title}</h3>
              <span className="text-sm text-muted break-words">
                {[album.artist, album.year].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              {album.postSlug ? (
                <Link
                  href={`/blog/${album.postSlug}`}
                  className="inline-flex min-h-11 items-center font-bold text-accent-ink underline-offset-4 hover:underline"
                >
                  Read review<span className="sr-only"> of {album.title}</span>
                  <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
              <RatingStamp rating={album.rating} size="sm" variant={album.rating >= 9 ? "filled" : "dashed"} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

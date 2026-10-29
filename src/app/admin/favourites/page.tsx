import type { Metadata } from "next";
import { FavouriteList } from "@/features/admin/favourites/FavouriteList";
import { getFavouritesAdmin } from "@/lib/admin/favourites";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Favourites" };

// The top 4 films and albums on /reviews (spec §6.4, §7 Favourites). Each
// change saves at once and the reviews hub shows it on the next load.
export default async function FavouritesPage() {
  await requireAdmin();
  const data = await getFavouritesAdmin();
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold">Favourites</h1>
        <p className="max-w-prose text-muted">
          The top 4 films and albums on the reviews page. Drag to reorder, or focus a handle, press Space and use the arrow keys.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <FavouriteList kind="FILM" initial={data.films} choices={data.filmChoices} />
        <FavouriteList kind="ALBUM" initial={data.albums} choices={data.albumChoices} />
      </div>
    </section>
  );
}

// The favourites admin's shapes (spec §7 Favourites, §8 Favorite). Browser-safe:
// the list component and the server action share them.

/** At most this many favourites per kind (Favorite.position 1–4). */
export const MAX_FAVOURITES = 4;

/** A favourite as the list shows it and setFavorites takes it. */
export type FavouriteItem = {
  ref?: { filmLogId?: string; reviewId?: string };
  title: string;
  artist?: string;
  year?: number;
  coverUrl?: string;
};

/** One thing the picker offers, under a group heading. */
export type FavouriteChoice = { key: string; group: string; label: string; item: FavouriteItem };

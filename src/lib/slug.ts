/** NFKD-normalise, strip diacritics, lowercase, collapse non-alphanumerics to "-". */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns `base`, or `base-2`, `base-3`, … whichever is first not taken. */
export async function uniqueSlug(
  base: string,
  taken: (s: string) => Promise<boolean>,
): Promise<string> {
  if (!(await taken(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}

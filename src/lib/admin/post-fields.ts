// Post fields the editor and the save action agree on (spec §7). Pure and
// browser-safe.

/** Blog tags: lower-cased, trimmed, leading # removed, no blanks or duplicates. */
export function normalizeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#+/, "").trim().toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

export const EXCERPT_LENGTH = 160;

/** The default excerpt: the first 160 characters of the text, cut at a word. */
export function excerptFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= EXCERPT_LENGTH) return clean;
  const cut = clean.slice(0, EXCERPT_LENGTH - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

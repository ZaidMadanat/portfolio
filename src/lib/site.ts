// The public origin for absolute links (emails, RSS). NEXT_PUBLIC_ vars are
// inlined at build time, so static output and the server agree.
export const DEFAULT_SITE_URL = "https://zaidmadanat.com";

/** `NEXT_PUBLIC_SITE_URL` without a trailing slash, else https://zaidmadanat.com. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

const CAL_HOST = /^https?:\/\/(?:app\.|www\.)?cal\.com\//i;

/**
 * Normalises NEXT_PUBLIC_CALCOM_LINK to the "user/event" form Cal's embed
 * expects. Accepts a full cal.com URL too. Blank or unset gives null, which
 * means the contact page shows the email fallback.
 */
export function calLinkFromEnv(value: string | undefined): string | null {
  const link = (value ?? "")
    .trim()
    .replace(CAL_HOST, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  return link || null;
}

const CAL_HOST = /^https?:\/\/(?:app\.|www\.)?cal\.com\//i;
const MINUTES = /^(\d+)-?min(?:ute)?s?$/i;

/** One bookable Cal.com event: its "user/event" link and the switch label. */
export type CalEvent = { link: string; label: string };

function normalise(value: string): string {
  return value
    .trim()
    .replace(CAL_HOST, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
}

/** "15min" or "15-minutes" reads "15 min"; any other slug, with spaces for dashes. */
function labelFor(link: string): string {
  const slug = link.split("/").at(-1) ?? link;
  const minutes = MINUTES.exec(slug);
  return minutes ? `${minutes[1]} min` : slug.replace(/[-_]+/g, " ");
}

/**
 * Parses NEXT_PUBLIC_CALCOM_LINK: one or more Cal.com links, comma-separated,
 * each "user/event" or a full cal.com URL, in the order the switch shows them.
 * Blank or unset gives [], which means the contact page shows the email fallback.
 */
export function calEventsFromEnv(value: string | undefined): CalEvent[] {
  const links = (value ?? "").split(",").map(normalise).filter(Boolean);
  return [...new Set(links)].map((link) => ({ link, label: labelFor(link) }));
}

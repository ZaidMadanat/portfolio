import type { Dashboard } from "@/lib/admin/dashboard";
import { formatDate, plural } from "@/lib/format";

// The dashboard's stat tiles (spec §7).

const TILE = "flex min-w-0 flex-[1_1_10rem] flex-col gap-1 rounded-3xl border-2 border-ink p-4 sm:p-5";
const nf = new Intl.NumberFormat("en-US");

/** Snapshot days are UTC calendar dates, so they're formatted in UTC. */
function viewsNote(views: Dashboard["stats"]["views"]): string {
  if (!views.since) return "not counted yet";
  return views.full ? "last 30 days" : `since ${formatDate(views.since)}`;
}

export function StatTiles({ stats }: { stats: Dashboard["stats"] }) {
  const { reviews, views } = stats;
  const tiles = [
    { label: "Published posts", value: stats.published, note: "on the blog", tone: "bg-soft" },
    { label: "Drafts", value: stats.drafts, note: stats.drafts > 0 ? "waiting below" : "nothing waiting", tone: "bg-surface" },
    {
      label: "Reviews",
      value: reviews.total,
      note: `${reviews.FOOD} food · ${reviews.FILM} film · ${plural(reviews.ALBUM, "album")} · ${plural(reviews.CONCERT, "concert")}`,
      tone: "bg-soft2",
    },
    { label: "Confirmed subscribers", value: stats.confirmedSubscribers, note: "get new posts by email", tone: "bg-surface" },
    {
      label: "Views",
      value: views.recent,
      note: viewsNote(views),
      tone: "bg-soft",
    },
  ];

  return (
    <ul aria-label="Stats" className="flex flex-wrap gap-3.5">
      {tiles.map((t) => (
        <li key={t.label} className={`${TILE} ${t.tone}`}>
          <span className="text-[13px] font-bold text-muted">{t.label}</span>
          <span data-testid="stat-value" className="font-display text-4xl leading-tight font-extrabold">
            {nf.format(t.value)}
          </span>
          <span className="text-[13px] text-muted">{t.note}</span>
        </li>
      ))}
    </ul>
  );
}

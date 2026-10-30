import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDuration, formatMiles, formatMonthDay, plural, SITE_TIME_ZONE, sportLabel } from "@/lib/format";
import type { StravaActivityView } from "@/lib/queries/strava";
import type { StravaSummary } from "@/lib/strava-summary";

type Props = {
  summary: StravaSummary<StravaActivityView>;
  profileUrl: string;
};

const CHIP = "rounded-2xl border-2 border-ink px-4 py-2.5 font-bold";

export function OffTheKeyboard({ summary, profileUrl }: Props) {
  const { miles, walks, runs, hikes, lifts, movingHours, items } = summary;
  const counts = [
    walks && plural(walks, "walk"),
    runs && plural(runs, "run"),
    hikes && plural(hikes, "hike"),
  ].filter(Boolean) as string[];

  return (
    <section aria-labelledby="strava-heading" className="flex flex-col gap-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="strava-heading" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Off the keyboard
        </h2>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-4 hover:underline"
        >
          Follow on Strava<span aria-hidden="true">&nbsp;→</span>
        </a>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No activities in the last two weeks." />
      ) : (
        <Card className="flex flex-col overflow-hidden md:flex-row">
          <div className="flex flex-col gap-5 border-b-2 border-ink bg-soft2 p-7 sm:p-9 md:w-2/5 md:shrink-0 md:border-r-2 md:border-b-0">
            <p className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">Last 14 days</p>
            <p className="font-display text-6xl leading-none font-extrabold">
              {miles} <span className="text-3xl">mi</span>
            </p>
            <ul aria-label="Totals" className="flex flex-wrap gap-3">
              {counts.map((c) => (
                <li key={c} className={`${CHIP} bg-surface`}>
                  {c}
                </li>
              ))}
              {lifts ? <li className={`${CHIP} bg-accent text-on-accent`}>{plural(lifts, "lift")}</li> : null}
              <li className={`${CHIP} bg-surface`}>~{movingHours} hrs moving</li>
            </ul>
          </div>
          <ul aria-label="Activities" className="flex min-w-0 flex-1 flex-col px-6 py-3 sm:px-8">
            {items.map((a) => {
              const lift = a.sportType === "WeightTraining";
              const amount = [a.distanceM > 0 && formatMiles(a.distanceM), formatDuration(a.movingS)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={a.id} className="flex items-center gap-4 border-b border-line py-3.5 last:border-b-0">
                  <span
                    aria-hidden="true"
                    className={`size-10 shrink-0 border-2 border-ink ${lift ? "rounded-xl bg-accent" : "rounded-full bg-second"}`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold break-words">{a.name}</span>
                    <span className="text-sm text-muted">
                      {sportLabel(a.sportType)} · {formatMonthDay(a.startAt, SITE_TIME_ZONE)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-bold whitespace-nowrap sm:text-base">{amount}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}

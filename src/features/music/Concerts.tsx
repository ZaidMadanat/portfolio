import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import type { Concert } from "@/lib/queries/music";

const TILTS = [-0.8, 0.6];
const STUBS = ["bg-accent text-on-accent", "bg-second text-on-second"];

// CONCERT reviews as ticket stubs (spec §6.7): artist, venue, date and the
// highlight on the ticket, the rating on the torn-off stub.
export function Concerts({ concerts, id, headingId }: { concerts: Concert[]; id: string; headingId: string }) {
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-6 flex-col gap-6">
      <h2 id={headingId} className="font-display text-3xl font-extrabold sm:text-4xl">
        Concerts
      </h2>
      <ul className="grid gap-6 md:grid-cols-2">
        {concerts.map((c, i) => (
          <li key={c.id} className="min-w-0">
            <Card as="article" tilt={TILTS[i % TILTS.length]} lift className="flex h-full overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-5 sm:p-6">
                <span className="text-xs font-extrabold tracking-[0.08em] text-muted uppercase">
                  Admit one · {formatDate(c.date)}
                </span>
                <h3 className="font-display text-2xl leading-tight font-extrabold break-words sm:text-3xl">{c.artist}</h3>
                {c.venue ? <span className="text-muted break-words">{c.venue}</span> : null}
                {c.highlight ? (
                  <span className="pt-1.5 text-[15px] break-words">
                    Highlight: <strong>{c.highlight}</strong>
                  </span>
                ) : null}
              </div>
              <div
                data-testid="ticket-stub"
                className={`flex w-24 shrink-0 items-center justify-center border-l-3 border-dashed border-ink sm:w-30 ${STUBS[i % STUBS.length]}`}
              >
                <span role="img" aria-label={`${c.rating} out of 10`} className="wiggle flex flex-col items-center">
                  <span className="font-display text-5xl leading-none font-extrabold">{c.rating}</span>
                  <span className="text-[13px] font-bold">out of 10</span>
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

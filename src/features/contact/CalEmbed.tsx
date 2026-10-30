"use client";

import { useTheme } from "next-themes";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CalEvent } from "./cal-link";

// Neither the embed-react chunk nor Cal's embed.js loads until the card is on screen.
const Cal = lazy(() => import("@calcom/embed-react"));

type CalEmbedProps = {
  /** The bookable events, already parsed by calEventsFromEnv. At least one. */
  events: CalEvent[];
};

type Theme = "dark" | "light";
type EmbedConfig = { layout: "month_view"; theme: Theme };

export function CalEmbed({ events }: CalEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef(theme);
  const [selected, setSelected] = useState(0);
  const event = events[selected] ?? events[0];
  // One namespace per event, so switching mounts a fresh embed instead of
  // re-initialising one Cal already set up.
  const namespace = `contact-${selected}`;
  // Cal reads `config` once, when it mounts, so it is fixed at intersection
  // time (after hydration, when the theme is known) and again on each switch.
  // Later theme changes go through the "ui" API below.
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const visible = config !== null;

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        setConfig({ layout: "month_view", theme: themeRef.current });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    import("@calcom/embed-react")
      .then(({ getCalApi }) => getCalApi({ namespace }))
      .then((cal) => {
        if (!cancelled) cal("ui", { theme });
      })
      .catch(() => {
        // The embed failed to load; the email button above still works.
      });
    return () => {
      cancelled = true;
    };
  }, [visible, theme, namespace]);

  function choose(index: number) {
    setSelected(index);
    if (visible) setConfig({ layout: "month_view", theme: themeRef.current });
  }

  return (
    <div className="flex flex-col gap-4">
      {events.length > 1 && (
        <div role="group" aria-label="Meeting length" className="flex flex-wrap gap-2">
          {events.map((e, i) => {
            const on = i === selected;
            return (
              <button
                key={e.link}
                type="button"
                aria-pressed={on}
                onClick={() => choose(i)}
                className={`min-h-11 cursor-pointer rounded-full border-2 border-ink px-4 py-2 font-bold ${
                  on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-soft"
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      )}
      <div ref={ref} className="min-h-96 w-full">
        {config && (
          <Suspense fallback={null}>
            <Cal
              key={event.link}
              namespace={namespace}
              calLink={event.link}
              config={config}
              className="w-full overflow-auto"
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

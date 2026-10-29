"use client";

import { useTheme } from "next-themes";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// Neither the embed-react chunk nor Cal's embed.js loads until the card is on screen.
const Cal = lazy(() => import("@calcom/embed-react"));

const NAMESPACE = "contact";

type CalEmbedProps = {
  /** Cal.com "user/event" link, already normalised by calLinkFromEnv. */
  calLink: string;
};

type Theme = "dark" | "light";
type EmbedConfig = { layout: "month_view"; theme: Theme };

export function CalEmbed({ calLink }: CalEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef(theme);
  // Cal reads `config` once, when it mounts, so it is fixed at intersection
  // time (after hydration, when the theme is known). Later theme changes go
  // through the "ui" API below.
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
      .then(({ getCalApi }) => getCalApi({ namespace: NAMESPACE }))
      .then((cal) => {
        if (!cancelled) cal("ui", { theme });
      })
      .catch(() => {
        // The embed failed to load; the email button above still works.
      });
    return () => {
      cancelled = true;
    };
  }, [visible, theme]);

  return (
    <div ref={ref} className="min-h-96 w-full">
      {config && (
        <Suspense fallback={null}>
          <Cal
            namespace={NAMESPACE}
            calLink={calLink}
            config={config}
            className="w-full overflow-auto"
          />
        </Suspense>
      )}
    </div>
  );
}

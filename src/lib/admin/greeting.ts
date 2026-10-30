import { SITE_TIME_ZONE } from "@/lib/format";

// The dashboard greeting (spec §7), by the time of day where Zaid lives.

export type DayPart = "Morning" | "Afternoon" | "Evening";

/** 05:00–11:59 Morning, 12:00–16:59 Afternoon, otherwise Evening (Los Angeles time). */
export function dayPart(now: Date): DayPart {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: SITE_TIME_ZONE }).format(now),
  );
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
}

/** "Morning, Zaid." */
export function greeting(now: Date): string {
  return `${dayPart(now)}, Zaid.`;
}

import { describe, expect, it } from "vitest";
import { summarizeStrava } from "@/lib/strava-summary";

const NOW = new Date("2026-10-28T20:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const act = (sportType: string, distanceM: number, movingS: number, startAt: Date) => ({
  sportType,
  distanceM,
  movingS,
  startAt,
});

describe("summarizeStrava", () => {
  it("totals the last 14 days and drops older activities", () => {
    const acts = [
      act("Walk", 1609.34, 1800, daysAgo(1)),
      act("Walk", 1609.34, 1800, daysAgo(3)),
      act("WeightTraining", 0, 1800, daysAgo(5)),
      act("Walk", 1609.34, 1800, daysAgo(15)),
    ];
    const s = summarizeStrava(acts, NOW);
    expect(s).toMatchObject({ miles: 2.0, walks: 2, runs: 0, hikes: 0, lifts: 1, movingHours: 1.5 });
    expect(s.items).toHaveLength(3);
  });

  it("counts Run and TrailRun as runs and Hike as hikes, and rounds to 1 decimal", () => {
    const acts = [
      act("Run", 5000, 1500, daysAgo(2)),
      act("TrailRun", 8000, 3000, daysAgo(4)),
      act("Hike", 10000, 7200, daysAgo(6)),
      act("Ride", 20000, 3600, daysAgo(7)),
    ];
    const s = summarizeStrava(acts, NOW);
    expect(s.runs).toBe(2);
    expect(s.hikes).toBe(1);
    expect(s.walks).toBe(0);
    expect(s.lifts).toBe(0);
    // 43 km = 26.719 mi; 15300 s = 4.25 h.
    expect(s.miles).toBe(26.7);
    expect(s.movingHours).toBe(4.3);
  });

  it("keeps the window edges: exactly 14 days ago is in, the future is out", () => {
    const acts = [
      act("Walk", 1000, 600, daysAgo(14)),
      act("Walk", 1000, 600, new Date(NOW.getTime() + 60_000)),
    ];
    expect(summarizeStrava(acts, NOW).items).toHaveLength(1);
  });

  it("lists items newest first", () => {
    const acts = [act("Walk", 1, 1, daysAgo(5)), act("Walk", 1, 1, daysAgo(1)), act("Walk", 1, 1, daysAgo(3))];
    expect(summarizeStrava(acts, NOW).items.map((a) => a.startAt)).toEqual([daysAgo(1), daysAgo(3), daysAgo(5)]);
  });

  it("returns zeros and no items for no activities", () => {
    expect(summarizeStrava([], NOW)).toEqual({
      miles: 0,
      walks: 0,
      runs: 0,
      hikes: 0,
      lifts: 0,
      movingHours: 0,
      items: [],
    });
  });
});

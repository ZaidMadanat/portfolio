import { describe, expect, it } from "vitest";
import { utcDay, viewsWindow } from "@/lib/admin/views-window";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("viewsWindow", () => {
  it("is empty before anything is counted", () => {
    expect(viewsWindow([])).toEqual({ views: 0, since: null, full: false, asOf: null });
  });

  it("is today's total minus the total from 30 days ago", () => {
    const days = [
      { day: day("2026-09-01"), views: 10 },
      { day: day("2026-09-29"), views: 100 },
      { day: day("2026-10-15"), views: 180 },
      { day: day("2026-10-29"), views: 250 },
    ];
    expect(viewsWindow(days)).toEqual({ views: 150, since: day("2026-09-29"), full: true, asOf: day("2026-10-29") });
  });

  it("uses the newest snapshot at least 30 days old when that exact day is missing (a skipped cron)", () => {
    const days = [
      { day: day("2026-09-20"), views: 40 },
      { day: day("2026-09-27"), views: 90 },
      { day: day("2026-09-30"), views: 120 },
      { day: day("2026-10-29"), views: 250 },
    ];
    expect(viewsWindow(days)).toMatchObject({ views: 160, since: day("2026-09-27"), full: true });
  });

  it("falls back to the oldest snapshot, not a full window, when history is shorter than 30 days", () => {
    const days = [
      { day: day("2026-10-20"), views: 200 },
      { day: day("2026-10-10"), views: 120 },
      { day: day("2026-10-29"), views: 250 },
    ];
    expect(viewsWindow(days)).toEqual({ views: 130, since: day("2026-10-10"), full: false, asOf: day("2026-10-29") });
  });

  it("a single snapshot gives 0 since that day", () => {
    expect(viewsWindow([{ day: day("2026-10-29"), views: 250 }])).toEqual({
      views: 0,
      since: day("2026-10-29"),
      full: false,
      asOf: day("2026-10-29"),
    });
  });

  it("never goes negative (a counter store that was reset)", () => {
    const days = [
      { day: day("2026-09-01"), views: 500 },
      { day: day("2026-10-29"), views: 20 },
    ];
    expect(viewsWindow(days).views).toBe(0);
  });
});

describe("utcDay", () => {
  it("is the UTC calendar date at midnight", () => {
    expect(utcDay(new Date("2026-10-29T13:30:00Z"))).toEqual(day("2026-10-29"));
    expect(utcDay(new Date("2026-10-29T23:59:59.999Z"))).toEqual(day("2026-10-29"));
  });
});

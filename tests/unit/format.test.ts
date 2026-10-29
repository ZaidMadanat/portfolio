import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatMiles,
  formatMonthDay,
  plural,
  priceLabel,
  SITE_TIME_ZONE,
  sportLabel,
} from "@/lib/format";

describe("format", () => {
  it("formats calendar dates in UTC and timestamps in Pacific time", () => {
    expect(formatMonthDay(new Date("2026-04-26T00:00:00.000Z"))).toBe("Apr 26");
    expect(formatMonthDay("2026-04-26T00:00:00.000Z")).toBe("Apr 26");
    // 03:00 UTC is still the previous evening in Berkeley.
    expect(formatMonthDay("2026-10-24T03:00:00.000Z", SITE_TIME_ZONE)).toBe("Oct 23");
  });

  it("formats durations, distances, sports, prices and plurals", () => {
    expect(formatDuration(1800)).toBe("30 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
    expect(formatDuration(7200)).toBe("2 h");
    expect(formatMiles(4313)).toBe("2.68 mi");
    expect(sportLabel("WeightTraining")).toBe("Weight training");
    expect(sportLabel("Walk")).toBe("Walk");
    expect(priceLabel(2)).toBe("$$");
    expect(plural(1, "walk")).toBe("1 walk");
    expect(plural(3, "walk")).toBe("3 walks");
  });
});

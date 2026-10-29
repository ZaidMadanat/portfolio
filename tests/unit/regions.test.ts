import { describe, expect, it } from "vitest";
import { cityToRegion, REGION_LABELS } from "@/lib/regions";

describe("cityToRegion", () => {
  it("maps Bay Area cities, ignoring case and whitespace", () => {
    expect(cityToRegion("San Francisco")).toBe("SAN_FRANCISCO");
    expect(cityToRegion(" berkeley ")).toBe("EAST_BAY");
    expect(cityToRegion("Oakland")).toBe("EAST_BAY");
    expect(cityToRegion("Palo Alto")).toBe("PENINSULA");
    expect(cityToRegion("San Jose")).toBe("SOUTH_BAY");
    expect(cityToRegion("Mountain View")).toBe("SOUTH_BAY");
    expect(cityToRegion("San Rafael")).toBe("NORTH_BAY");
  });

  it("returns null for unmapped cities", () => {
    expect(cityToRegion("Sacramento")).toBeNull();
  });
});

describe("REGION_LABELS", () => {
  it("labels every region", () => {
    expect(REGION_LABELS).toEqual({
      SAN_FRANCISCO: "San Francisco",
      EAST_BAY: "East Bay",
      NORTH_BAY: "North Bay",
      PENINSULA: "Peninsula",
      SOUTH_BAY: "South Bay",
    });
  });
});

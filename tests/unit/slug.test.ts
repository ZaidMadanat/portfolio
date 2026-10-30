import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and collapses punctuation to hyphens", () => {
    expect(slugify("Ben-Hur deserves its 11 Oscars!")).toBe("ben-hur-deserves-its-11-oscars");
  });

  it("strips diacritics and repeated spaces", () => {
    expect(slugify("Café  Crème")).toBe("cafe-creme");
  });
});

describe("uniqueSlug", () => {
  it("appends the first free numeric suffix", async () => {
    await expect(uniqueSlug("a", async (s) => s === "a" || s === "a-2")).resolves.toBe("a-3");
  });

  it("returns the base when it is free", async () => {
    await expect(uniqueSlug("a", async () => false)).resolves.toBe("a");
  });
});

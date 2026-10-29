import { describe, expect, it } from "vitest";
import { readingMinutes } from "@/lib/reading-time";

// 230 words per minute, rounded up, minimum 1.
describe("readingMinutes", () => {
  it("rounds up at 230 words per minute", () => {
    expect(readingMinutes("word ".repeat(230))).toBe(1);
    expect(readingMinutes("word ".repeat(231))).toBe(2);
  });

  it("is at least 1 minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("   \n\t ")).toBe(1);
  });
});

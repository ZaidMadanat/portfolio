import { describe, expect, it } from "vitest";
import { excerptFrom, normalizeTags } from "@/lib/admin/post-fields";
import { savedLabel } from "@/features/admin/editor/saved-label";

describe("normalizeTags", () => {
  it("lower-cases, trims, strips # and drops duplicates and blanks", () => {
    expect(normalizeTags(["#Probability", " probability ", "Cheat-Sheet", "", " # ", "##Stats"])).toEqual([
      "probability",
      "cheat-sheet",
      "stats",
    ]);
  });
});

describe("excerptFrom", () => {
  it("keeps short text as it is", () => {
    expect(excerptFrom("A short post.")).toBe("A short post.");
  });

  it("cuts long text to at most 160 characters on a word boundary", () => {
    const text = "word ".repeat(60).trim();
    const out = excerptFrom(text);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("word…")).toBe(true);
  });
});

describe("savedLabel", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000);
  it("reads like the canvas: Saved · just now, then minutes and hours", () => {
    expect(savedLabel(ago(5), now)).toBe("Saved · just now");
    expect(savedLabel(ago(90), now)).toBe("Saved · 1 min ago");
    expect(savedLabel(ago(60 * 14), now)).toBe("Saved · 14 min ago");
    expect(savedLabel(ago(60 * 60 * 3), now)).toBe("Saved · 3 h ago");
  });
});

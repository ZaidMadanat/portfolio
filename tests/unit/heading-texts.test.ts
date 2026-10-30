import { describe, expect, it } from "vitest";
import { headingTexts } from "@/lib/blocks/render";

describe("headingTexts", () => {
  it("lists top-level headings from string or inline content, skipping blanks", () => {
    expect(
      headingTexts([
        { type: "heading", props: { level: 2 }, content: "Summary" },
        { type: "paragraph", content: "not a heading" },
        { type: "heading", content: [{ type: "text", text: "Key " }, { type: "text", text: "ideas" }] },
        { type: "heading", content: "  " },
        "junk",
      ]),
    ).toEqual(["Summary", "Key ideas"]);
  });

  it("never throws on bad input", () => {
    expect(headingTexts(null as unknown as unknown[])).toEqual([]);
  });
});

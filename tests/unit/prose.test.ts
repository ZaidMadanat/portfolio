import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { renderPostHtml } from "@/lib/blocks/render";
import type { PartialPostBlock } from "@/lib/blocks/schema";

// Spec §7.2: public pages style Post.html with our own prose CSS, not
// BlockNote's editor CSS, and a mapping test checks the class names. This
// renders every block type the editor offers and checks both directions:
// every hook prose.css targets exists in the output, and every block type in
// the output has a rule.

const ALL_BLOCKS = [
  { type: "heading", props: { level: 1 }, content: "H1" },
  { type: "heading", props: { level: 2 }, content: "H2" },
  { type: "heading", props: { level: 3 }, content: "H3" },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Bold", styles: { bold: true } },
      { type: "text", text: " code", styles: { code: true } },
      { type: "text", text: " red", styles: { textColor: "red" } },
      { type: "text", text: " marked", styles: { backgroundColor: "yellow" } },
      { type: "link", href: "https://example.com", content: "link" },
    ],
  },
  { type: "bulletListItem", content: "One", children: [{ type: "bulletListItem", content: "Nested" }] },
  { type: "numberedListItem", content: "First" },
  { type: "checkListItem", props: { checked: true }, content: "Done" },
  { type: "toggleListItem", content: "Toggle", children: [{ type: "paragraph", content: "Inside" }] },
  { type: "quote", content: "A pull quote." },
  { type: "codeBlock", props: { language: "ts" }, content: "const a = 1;" },
  {
    type: "image",
    props: { url: "https://x.public.blob.vercel-storage.com/media/abc/960.webp", caption: "Caption", previewWidth: 512 },
  },
  { type: "divider" },
  { type: "table", content: { type: "tableContent", rows: [{ cells: ["a", "b"] }, { cells: ["c", "d"] }] } },
  { type: "math", props: { latex: "z = \\frac{x}{y}" } },
  { type: "callout", props: { variant: "tip" }, content: "Tip" },
  { type: "callout", props: { variant: "warning" }, content: "Warning" },
] as unknown as PartialPostBlock[];

const css = readFileSync(join(process.cwd(), "src/app/(site)/blog/prose.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

let html = "";
beforeAll(async () => {
  html = await renderPostHtml(ALL_BLOCKS);
});

const unique = (xs: string[]) => [...new Set(xs)].sort();
const attrValues = (name: string) => unique([...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1]));

describe("prose.css ↔ rendered post HTML", () => {
  it("every block type prose.css targets is rendered, and every rendered block type is styled", () => {
    const targeted = unique([...css.matchAll(/\[data-content-type="([^"]+)"\]/g)].map((m) => m[1]));
    const rendered = attrValues("data-content-type");
    expect(targeted).toEqual(rendered);
  });

  it("every class prose.css targets exists in the output", () => {
    const classes = unique(
      [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => c !== "prose" && c !== "dark"),
    );
    const rendered = new Set(attrValues("class").flatMap((v) => v.split(/\s+/)));
    const missing = classes.filter((c) => !rendered.has(c));
    expect(missing).toEqual([]);
  });

  it("every data-style-type prose.css targets exists in the output", () => {
    const styles = unique([...css.matchAll(/\[data-style-type="([^"]+)"\]/g)].map((m) => m[1]));
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.filter((s) => !attrValues("data-style-type").includes(s))).toEqual([]);
  });
});

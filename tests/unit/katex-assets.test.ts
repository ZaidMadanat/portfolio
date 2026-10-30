import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { vendoredCss, woff2Fonts } from "../../scripts/vendor-katex.mjs";

const PUBLIC = join(process.cwd(), "public/katex");

describe("vendored KaTeX assets", () => {
  it("public/katex matches the installed katex (re-run scripts/vendor-katex.mjs after an upgrade)", () => {
    expect(readFileSync(join(PUBLIC, "katex.min.css"), "utf8")).toBe(vendoredCss());
    expect(readdirSync(join(PUBLIC, "fonts")).sort()).toEqual(woff2Fonts());
  });

  it("references only woff2 fonts that are present", () => {
    const css = readFileSync(join(PUBLIC, "katex.min.css"), "utf8");
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith("fonts/") && u.endsWith(".woff2"))).toBe(true);
    const fonts = new Set(readdirSync(join(PUBLIC, "fonts")));
    expect(urls.filter((u) => !fonts.has(u.slice("fonts/".length)))).toEqual([]);
  });
});

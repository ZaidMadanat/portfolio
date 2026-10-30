import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Spec §5: all decorative motion lives in src/styles/motion.css, inside
// `prefers-reduced-motion: no-preference` and scoped to [data-motion="on"].
// Nothing else in src may animate on its own.

const ROOT = join(import.meta.dirname, "../..");
const SRC = join(ROOT, "src");
const MOTION_CSS = "src/styles/motion.css";

// Recorded exception (agent-coordination.md, "Motion exceptions"): dnd-kit's
// inline transition is functional drag feedback in the admin, and it is
// switched off when the visitor prefers reduced motion.
const ALLOWED = new Set([
  "src/features/admin/favourites/FavouriteList.tsx: transition: reducedMotion ? null : undefined,",
  "src/features/admin/favourites/FavouriteList.tsx: style={{ transform: CSS.Translate.toString(transform), transition }}",
]);

// Tailwind transition/animation utilities and raw CSS motion.
const MOTION = [
  /\btransition(-(all|colors|opacity|shadow|transform|\[[^\]]*\]))?(?=[\s"'`])/,
  /\bduration-\d/,
  /\banimate-[a-z]/,
  /@keyframes\b/,
  /\banimation\s*:/,
  /\btransition\s*:/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : files(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("motion layer", () => {
  it("keeps every transition and animation in motion.css", () => {
    const offenders: string[] = [];
    for (const path of files(SRC)) {
      const rel = relative(ROOT, path);
      if (rel === MOTION_CSS) continue;
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (ALLOWED.has(`${rel}: ${line.trim()}`)) return;
          if (MOTION.some((re) => re.test(line))) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("wraps motion.css in prefers-reduced-motion: no-preference and scopes rules to data-motion", () => {
    const css = readFileSync(join(ROOT, MOTION_CSS), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const open = css.indexOf("@media (prefers-reduced-motion: no-preference) {");
    expect(open).toBeGreaterThanOrEqual(0);
    // Nothing but the media block at the top level.
    expect(css.slice(0, open).trim()).toBe("");
    expect(css.trimEnd().endsWith("}")).toBe(true);
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1].trim())
      .filter((s) => !/^(@|from\b|to\b|\d+%)/.test(s));
    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors) {
      for (const part of sel.split(",")) expect(part.trim()).toMatch(/^\[data-motion="on"\]/);
    }
  });

  it("gives the food-map pin body its grow transition from motion.css", () => {
    const css = readFileSync(join(ROOT, MOTION_CSS), "utf8");
    expect(css).toMatch(/\[data-motion="on"\] \.pin-grow \{[^}]*transition:[^}]*width[^}]*height[^}]*font-size/);
    const map = readFileSync(join(SRC, "features/food/FoodMap.tsx"), "utf8");
    expect(map).toContain("pin-grow");
  });
});

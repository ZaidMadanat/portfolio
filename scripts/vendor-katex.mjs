// Copies KaTeX's stylesheet and woff2 fonts into public/katex/, so the post
// page can load them only on posts that contain math (spec §7.2). Run it after
// upgrading katex: `node scripts/vendor-katex.mjs`. A unit test
// (tests/unit/katex-assets.test.ts) fails if the copy is out of date.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "node_modules/katex/dist");
const TARGET = join(ROOT, "public/katex");

/** The installed KaTeX version. */
export function katexVersion() {
  return JSON.parse(readFileSync(join(ROOT, "node_modules/katex/package.json"), "utf8")).version;
}

/**
 * katex-swap.min.css (font-display: swap) with only the woff2 sources: every
 * browser this site supports reads woff2, so the woff/ttf files never ship.
 */
export function vendoredCss() {
  const css = readFileSync(join(SOURCE, "katex-swap.min.css"), "utf8").replace(
    /,url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g,
    "",
  );
  return `/* KaTeX ${katexVersion()} (MIT), from scripts/vendor-katex.mjs */\n${css}`;
}

/** The woff2 font file names. */
export function woff2Fonts() {
  return readdirSync(join(SOURCE, "fonts"))
    .filter((f) => f.endsWith(".woff2"))
    .sort();
}

function main() {
  mkdirSync(join(TARGET, "fonts"), { recursive: true });
  writeFileSync(join(TARGET, "katex.min.css"), vendoredCss());
  for (const f of woff2Fonts()) copyFileSync(join(SOURCE, "fonts", f), join(TARGET, "fonts", f));
  console.log(`Vendored KaTeX ${katexVersion()} into public/katex/.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

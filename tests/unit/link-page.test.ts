import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// public/email/link-page.css styles the confirm/unsubscribe pages, which are
// route handlers outside the app layout. Its tokens must equal globals.css.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function tokens(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{3,8})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

function split(css: string, darkMarker: string): [string, string] {
  const i = css.indexOf(darkMarker);
  expect(i).toBeGreaterThan(0);
  return [css.slice(0, i), css.slice(i)];
}

describe("public/email/link-page.css", () => {
  it("uses exactly the Citrus Pop light and dark tokens from globals.css", () => {
    const [appLight, appDark] = split(read("src/app/globals.css"), ".dark {");
    const [pageLight, pageDark] = split(read("public/email/link-page.css"), "@media (prefers-color-scheme: dark)");
    expect(Object.keys(tokens(appLight))).toHaveLength(12);
    expect(tokens(pageLight)).toEqual(tokens(appLight));
    expect(tokens(pageDark)).toEqual(tokens(appDark));
  });
});

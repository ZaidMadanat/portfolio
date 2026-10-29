import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// serverExternalPackages are loaded by Node at runtime, not bundled. Vercel's
// function runtime has no require(esm), so a CJS dependency that require()s an
// ES module (jsdom >= 27 does, via @exodus/bytes) crashes every admin page that
// imports the renderer. Load each one with require(esm) off to match Vercel.
describe("server external packages", () => {
  it.each(nextConfig.serverExternalPackages ?? [])("%s loads without require(esm)", (pkg) => {
    const res = spawnSync(
      process.execPath,
      ["--no-experimental-require-module", "--input-type=module", "-e", `await import(${JSON.stringify(pkg)})`],
      { encoding: "utf8", timeout: 60_000 },
    );
    expect(res.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
    expect(res.status).toBe(0);
  });
});

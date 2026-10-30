import { afterEach, describe, expect, it, vi } from "vitest";

// next.config.ts sets env.CACHE_BUILD_KEY once per `next build`; Next inlines
// it into the server bundle, so build and runtime share it (src/lib/cache.ts).
async function loadConfig() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

describe("next.config CACHE_BUILD_KEY", () => {
  it("uses the Vercel deployment id when there is one", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_123");
    expect((await loadConfig()).env?.CACHE_BUILD_KEY).toBe("dpl_123");
  });

  it("falls back to a fresh value per build elsewhere", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    const a = (await loadConfig()).env?.CACHE_BUILD_KEY;
    await new Promise((r) => setTimeout(r, 2));
    const b = (await loadConfig()).env?.CACHE_BUILD_KEY;
    expect(a).toMatch(/^local-/);
    expect(b).toMatch(/^local-/);
    expect(a).not.toBe(b);
  });
});

describe("next.config file tracing", () => {
  // The local media store (src/lib/media/store.ts) writes into public/uploads
  // in dev. Those files, and the private planning docs, must never be traced
  // into a server function, even if a dynamic fs call slips back in.
  it("excludes local uploads and private files from every route's trace", async () => {
    const excludes = (await loadConfig()).outputFileTracingExcludes?.["/*"];
    expect(excludes).toEqual(
      expect.arrayContaining(["public/uploads/**/*", "docs/**/*", ".claude/**/*", "agent-coordination.md"]),
    );
  });
});

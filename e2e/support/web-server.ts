// Playwright's webServer command (playwright.config.ts). Public pages are static,
// so each database state needs its own build:
//   1. prepare `site_e2e` (dev fixtures) and `site_e2e_empty` (no rows);
//   2. build against the empty DB and copy the output to .next-e2e-empty;
//   3. build against the seeded DB into .next;
//   4. serve the empty build on 3101, then the seeded build on 3100.
// Builds always use the default distDir: a custom one makes `next build`
// rewrite tsconfig.json. Only `next start` reads NEXT_DIST_DIR.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { prepareDatabase } from "./databases";
import { EMPTY_DB_URL, EMPTY_PORT, EMPTY_URL, SEEDED_DB_URL, SEEDED_PORT } from "./servers";

const EMPTY_DIST = ".next-e2e-empty";

// Admin e2e signs in with the email+password test accounts (src/lib/auth.ts).
// These are `next start` servers, so NODE_ENV is production here; auth.ts
// refuses E2E_AUTH only on Vercel.
process.env.E2E_AUTH = "1";

// Each build keys its unstable_cache entries by its own CACHE_BUILD_KEY
// (next.config.ts), so the empty build's entries can't leak into the seeded one.
function build(databaseUrl: string) {
  const res = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (res.status !== 0) throw new Error(`next build failed against ${new URL(databaseUrl).pathname}`);
}

const children: ChildProcess[] = [];

function serve(port: number, env: Record<string, string>) {
  const child = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) process.exit(code);
  });
  children.push(child);
}

async function waitFor(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not come up`);
}

function shutdown() {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await prepareDatabase(SEEDED_DB_URL, { fixtures: true });
await prepareDatabase(EMPTY_DB_URL, { fixtures: false });

build(EMPTY_DB_URL);
rmSync(EMPTY_DIST, { recursive: true, force: true });
cpSync(".next", EMPTY_DIST, { recursive: true, filter: (src) => !src.startsWith(".next/cache") });

build(SEEDED_DB_URL);

serve(EMPTY_PORT, { DATABASE_URL: EMPTY_DB_URL, NEXT_DIST_DIR: EMPTY_DIST });
await waitFor(EMPTY_URL);
serve(SEEDED_PORT, { DATABASE_URL: SEEDED_DB_URL });

// `npm run check:static` (after `next build`). Two checks on the build output:
//
// 1. Every public route in the plan's Global Constraints is static or ISR
//    (prerender-manifest.json), never rendered on demand (ƒ).
// 2. No server trace (.next/**/*.nft.json) pulls in the private planning files
//    or env files, so they can never ship in a deploy bundle.
//
// Usage: node scripts/check-static-routes.mjs [distDir]   (default .next)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Global Constraints: these must build as static/ISR. */
export const PUBLIC_ROUTES = [
  "/",
  "/blog",
  "/blog/[slug]",
  "/reviews",
  "/reviews/food",
  "/reviews/film",
  "/reviews/music",
  "/contact",
  "/rss.xml",
];

/**
 * @param {{ appPaths: Record<string, string>, prerender: { routes: Record<string, unknown>, dynamicRoutes: Record<string, unknown> } }} build
 *   app-path-routes-manifest.json and prerender-manifest.json
 * @returns {string[]} one message per route that is missing or dynamic
 */
export function checkStaticRoutes({ appPaths, prerender }) {
  const built = new Set(Object.values(appPaths));
  const problems = [];
  for (const route of PUBLIC_ROUTES) {
    if (!built.has(route)) problems.push(`${route} is missing from the build`);
    else if (route.includes("[")) {
      // A dynamic segment is ISR when it has a prerender entry (generateStaticParams).
      if (!prerender.dynamicRoutes?.[route]) problems.push(`${route} is dynamic (ƒ): it has no prerender (ISR) entry`);
    } else if (!prerender.routes?.[route]) problems.push(`${route} is dynamic (ƒ): it is not prerendered`);
  }
  return problems;
}

const PRIVATE = [/^docs\//, /^\.claude(\/|$)/, /^agent-coordination\.md$/, /(^|\/)\.env[^/]*$/];

/** The repo-relative paths that must never be traced into a server bundle. */
export function privateTraced(paths) {
  return paths.filter((p) => PRIVATE.some((re) => re.test(p)));
}

function nftFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "cache" ? [] : nftFiles(path);
    return e.name.endsWith(".nft.json") ? [path] : [];
  });
}

/**
 * @param {string} dist the build folder
 * @param {string} root the repo root the traced paths resolve against
 * @returns {{ count: number, problems: string[] }}
 */
export function checkTracedFiles(dist, root = ROOT) {
  const traces = nftFiles(dist);
  const problems = [];
  for (const trace of traces) {
    const { files = [] } = JSON.parse(readFileSync(trace, "utf8"));
    const paths = files.map((f) => relative(root, resolve(dirname(trace), f)).split("\\").join("/"));
    for (const p of privateTraced(paths)) problems.push(`${relative(dist, trace)} traces ${p}`);
  }
  return { count: traces.length, problems };
}

function main() {
  const dist = resolve(ROOT, process.argv[2] ?? ".next");
  const read = (name) => {
    const path = join(dist, name);
    if (!existsSync(path)) {
      console.error(`check:static: ${relative(ROOT, path)} not found. Run \`npm run build\` first.`);
      process.exit(1);
    }
    return JSON.parse(readFileSync(path, "utf8"));
  };
  const routeProblems = checkStaticRoutes({
    appPaths: read("app-path-routes-manifest.json"),
    prerender: read("prerender-manifest.json"),
  });
  const traced = checkTracedFiles(dist);
  const problems = [...routeProblems, ...traced.problems];
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log(`✓ ${PUBLIC_ROUTES.length} public routes are static/ISR: ${PUBLIC_ROUTES.join(", ")}`);
  console.log(`✓ ${traced.count} .nft.json traces include no docs/, .claude/, agent-coordination.md or .env* file`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

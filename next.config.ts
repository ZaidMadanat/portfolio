import type { NextConfig } from "next";

// One value per `next build`, inlined into the bundle through `env` so the
// build and the server it produces agree. src/lib/cache.ts adds it to every
// unstable_cache key, so a build never reuses entries from an earlier build.
// Vercel: the deployment id (a redeploy gets a new one). Elsewhere: the time
// this config was loaded, i.e. build start.
const CACHE_BUILD_KEY = process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now().toString(36)}`;

// cacheComponents and the React Compiler stay off: public pages rely on
// segment config (`export const revalidate`) and tag-based revalidation.
const nextConfig: NextConfig = {
  env: { CACHE_BUILD_KEY },
  // Don't let `next dev` write AGENTS.md into the repo.
  agentRules: false,
  // e2e serves a second, empty-database build from its own folder
  // (e2e/support/web-server.ts). Unset everywhere else.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // BlockNote's server renderer pulls in JSDOM; load it from node_modules at
  // runtime instead of bundling it (spec §7.2).
  serverExternalPackages: ["@blocknote/server-util", "@blocknote/core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

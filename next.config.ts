import type { NextConfig } from "next";

// cacheComponents and the React Compiler stay off: public pages rely on
// segment config (`export const revalidate`) and tag-based revalidation.
const nextConfig: NextConfig = {
  // Don't let `next dev` write AGENTS.md into the repo.
  agentRules: false,
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

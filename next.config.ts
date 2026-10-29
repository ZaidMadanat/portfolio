import type { NextConfig } from "next";

// cacheComponents and the React Compiler stay off: public pages rely on
// segment config (`export const revalidate`) and tag-based revalidation.
const nextConfig: NextConfig = {
  // Don't let `next dev` write AGENTS.md into the repo.
  agentRules: false,
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

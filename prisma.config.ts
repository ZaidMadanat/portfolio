import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads env files. Pick up the gitignored local-dev
// `.env.local` (the same file Next loads); real env vars always win.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations use the direct (non-pooled) URL when one is set (Neon).
  // Optional, so `prisma generate` works without a database.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || undefined,
  },
});

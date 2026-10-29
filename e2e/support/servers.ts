// The two servers e2e/support/web-server.ts starts. Public pages are static, so
// their data is baked in at build time: each database state needs its own build.

/** Built against `site_e2e`, seeded with the dev fixtures (Playwright's baseURL). */
export const SEEDED_PORT = 3100;
/** Built against `site_e2e_empty`: migrated, no rows. For empty-state tests. */
export const EMPTY_PORT = 3101;

export const SEEDED_URL = `http://localhost:${SEEDED_PORT}`;
export const EMPTY_URL = `http://localhost:${EMPTY_PORT}`;

const BASE = process.env.E2E_DATABASE_URL ?? "postgresql://site:site@localhost:5433/site_e2e";

function withDb(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

export const SEEDED_DB_URL = BASE;
export const EMPTY_DB_URL = withDb(BASE, `${decodeURIComponent(new URL(BASE).pathname.slice(1))}_empty`);

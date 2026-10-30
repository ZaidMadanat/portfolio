import { execFileSync } from "node:child_process";
import pg from "pg";

// Integration tests get their own database (default `site_test` on the Docker
// Postgres), so truncating tables never wipes the dev data in `site`.
// TEST_DATABASE_URL overrides it (CI). DATABASE_URL is deliberately ignored.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://site:site@localhost:5433/site_test";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`Integration tests only run against a local database, not ${url.hostname}.`);
  }

  // Create the database if it's missing (connect to the server's default db).
  const name = decodeURIComponent(url.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }

  // Apply migrations (no-op when up to date).
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: "" },
  });
}

import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seed } from "../../prisma/seed";

// e2e gets its own databases on the Docker Postgres, so a run never touches the
// dev data in `site`. Each run recreates their contents from scratch.

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

async function createIfMissing(url: string) {
  const target = new URL(url);
  if (!LOCAL_HOSTS.includes(target.hostname)) {
    throw new Error(`e2e only runs against a local database, not ${target.hostname}.`);
  }
  const name = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(target);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }
}

async function truncateAll(db: PrismaClient) {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

/** Creates, migrates and empties the database; seeds the dev fixtures if asked. */
export async function prepareDatabase(url: string, { fixtures }: { fixtures: boolean }) {
  await createIfMissing(url);
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: "" },
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await truncateAll(db);
    if (fixtures) await seed(db, { fixtures: true });
  } finally {
    await db.$disconnect();
  }
}

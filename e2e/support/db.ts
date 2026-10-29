import { randomUUID } from "node:crypto";
import pg from "pg";
import { SEEDED_DB_URL } from "./servers";

// Direct access to the seeded e2e database (`site_e2e`) for admin specs that
// need rows the UI can't create yet (subscribers, sync runs) or a quick
// cleanup. Admin pages are dynamic, so rows written here show on the next load.
// Public pages are static: never write anything here that a public page shows.

/** Runs one query on a short-lived connection. */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString: SEEDED_DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** A cuid-shaped id that can't clash with a real one. */
export const e2eId = () => `e2e${randomUUID().replaceAll("-", "").slice(0, 20)}`;

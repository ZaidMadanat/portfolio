import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/lib/env";

// One Prisma client per process (and one across dev hot reloads), through the
// pg driver adapter that Prisma 7 requires. It's created on first use, so
// importing this module never needs DATABASE_URL; the first query does.

const globalForDb = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  return (globalForDb.__prisma ??= createClient());
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

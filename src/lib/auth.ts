import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import {
  authPolicyFromEnv,
  isAdminAccount,
  NOT_ADMIN,
  NOT_ADMIN_MESSAGE,
  validateIdentity,
  type AuthPolicy,
} from "@/lib/auth-policy";
import { db } from "@/lib/db";

// Better Auth for the admin only (spec §3, §7): GitHub, one numeric-id
// allowlist (src/lib/auth-policy.ts), database sessions in Postgres through
// Prisma. Two gates, both before anything is written:
//   - user.validateUserInfo: before a user is created or an account linked, and
//     on every GitHub sign-in, with the raw GitHub profile;
//   - databaseHooks.session.create.before: before any session, for any method.
// requireAdmin() re-checks on every admin request; the proxy only redirects.

/** Local only (dev, tests, e2e `next start`). Vercel must set BETTER_AUTH_SECRET. */
const DEV_SECRET = "local-dev-only-better-auth-secret-Qm7xV2pL9sK4wN8rT1yZ";

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET?.trim();
  if (value) return value;
  if (process.env.VERCEL) throw new Error("BETTER_AUTH_SECRET is not set");
  return DEV_SECRET;
}

/** BETTER_AUTH_URL when set (required on Vercel); locally, whichever localhost port served the request. */
function baseURL(): BetterAuthOptions["baseURL"] {
  const value = process.env.BETTER_AUTH_URL?.trim();
  if (value) return value;
  if (process.env.VERCEL) throw new Error("BETTER_AUTH_URL is not set");
  return { allowedHosts: ["localhost:*", "127.0.0.1:*"], protocol: "http" };
}

function github(): BetterAuthOptions["socialProviders"] {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    if (process.env.VERCEL) throw new Error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set");
    return {};
  }
  return { github: { clientId, clientSecret } };
}

/** Whether this server can offer "Sign in with GitHub" (no OAuth app locally yet). */
export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

/** True when the stored user's linked accounts make it the admin under `policy`. */
export async function isAdminUser(userId: string, policy: AuthPolicy = authPolicy): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, accounts: { select: { providerId: true, accountId: true } } },
  });
  return user ? isAdminAccount(user, user.accounts, policy) : false;
}

export function createAuth(policy: AuthPolicy) {
  return betterAuth({
    appName: "zaidmadanat.com",
    baseURL: baseURL(),
    secret: secret(),
    database: prismaAdapter(db, { provider: "postgresql" }),
    socialProviders: github(),
    emailAndPassword: { enabled: policy.e2e, disableSignUp: !policy.e2e },
    // Never attach a second sign-in method to an existing user by email.
    account: { accountLinking: { enabled: false } },
    user: { validateUserInfo: (data) => validateIdentity(data, policy) },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (!(await isAdminUser(session.userId, policy))) {
              throw new APIError("FORBIDDEN", { code: NOT_ADMIN, message: NOT_ADMIN_MESSAGE });
            }
          },
        },
      },
    },
    // Parallel e2e sign-ins from one IP would trip the per-endpoint limits.
    rateLimit: { enabled: !policy.e2e },
    telemetry: { enabled: false },
    // Lets server actions set auth cookies. Must stay last.
    plugins: [nextCookies()],
  });
}

const authPolicy = authPolicyFromEnv();

export const auth = createAuth(authPolicy);

/** Whether this server offers the e2e email+password test accounts. */
export const e2eAuthEnabled = authPolicy.e2e;

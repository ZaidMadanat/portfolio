// Who may use the admin (spec §7). Pure functions, so the rules are unit-tested
// without Better Auth or a database; src/lib/auth.ts wires them into its gates.
//
// Production: exactly one GitHub account, matched on its numeric user id
// (ADMIN_GITHUB_ID). Never the login, which can be renamed and then claimed by
// someone else. Never an email.
//
// e2e only (E2E_AUTH=1, refused on Vercel): email+password for two fixed test
// accounts. The admin one is marked by a test-only allowlist; the intruder
// exists to prove rejection.

export const NOT_ADMIN = "NOT_ADMIN";
export const NOT_ADMIN_MESSAGE = "This admin is private.";

export const E2E_ADMIN_EMAIL = "admin@e2e.test";
export const E2E_INTRUDER_EMAIL = "intruder@e2e.test";
const E2E_EMAILS: readonly string[] = [E2E_ADMIN_EMAIL, E2E_INTRUDER_EMAIL];
/** Test-only allowlist. Consulted only when `policy.e2e` is true. */
const E2E_ADMIN_EMAILS: readonly string[] = [E2E_ADMIN_EMAIL];

export type AuthPolicy = {
  /** Numeric GitHub user id of the one admin, or null (then nobody gets in through GitHub). */
  adminGithubId: string | null;
  /** E2E_AUTH=1: enable the email+password test accounts. */
  e2e: boolean;
};

const NUMERIC_ID = /^[1-9]\d*$/;

/**
 * Reads the policy from the environment. Throws if E2E_AUTH is set on Vercel
 * (preview or production). It can't key off NODE_ENV: the e2e servers are
 * `next start`, which runs with NODE_ENV=production.
 */
export function authPolicyFromEnv(source: Record<string, string | undefined> = process.env): AuthPolicy {
  const e2eFlag = source.E2E_AUTH?.trim();
  if (e2eFlag && (source.VERCEL || source.VERCEL_ENV)) {
    throw new Error("E2E_AUTH must never be set on Vercel. Remove it from the project's environment variables.");
  }
  const id = source.ADMIN_GITHUB_ID?.trim() ?? "";
  return { adminGithubId: NUMERIC_ID.test(id) ? id : null, e2e: e2eFlag === "1" };
}

/** The numeric GitHub user id from a raw GitHub profile, as a string, or null. */
export function githubIdOf(profile: unknown): string | null {
  const id = (profile as { id?: unknown } | null | undefined)?.id;
  if (typeof id === "number") return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
  if (typeof id === "string") return NUMERIC_ID.test(id) ? id : null;
  return null;
}

export type IdentityInput = {
  user: { email?: string | null };
  source: { method: string; action: string; oauth?: { providerId: string; profile?: Record<string, unknown> } };
};

export type IdentityRejection = { error: string; errorDescription: string };

const reject: IdentityRejection = { error: NOT_ADMIN, errorDescription: NOT_ADMIN_MESSAGE };

/**
 * Better Auth's `user.validateUserInfo` gate. It runs before a user is created,
 * before an account is linked, and on every GitHub sign-in (with the fresh
 * GitHub profile), so a stranger is refused before any row exists.
 */
export function validateIdentity({ user, source }: IdentityInput, policy: AuthPolicy): IdentityRejection | undefined {
  if (source.method === "oauth") {
    const id = source.oauth?.providerId === "github" ? githubIdOf(source.oauth.profile) : null;
    return id !== null && policy.adminGithubId !== null && id === policy.adminGithubId ? undefined : reject;
  }
  if (source.method === "email-password" && policy.e2e) {
    return E2E_EMAILS.includes((user.email ?? "").toLowerCase()) ? undefined : reject;
  }
  return reject;
}

type AccountRef = { providerId: string; accountId: string };

/**
 * Whether a stored user is the admin, from its linked accounts. Runs before
 * every session is created and again on every admin request.
 */
export function isAdminAccount(user: { email: string }, accounts: AccountRef[], policy: AuthPolicy): boolean {
  if (
    policy.adminGithubId !== null &&
    accounts.some((a) => a.providerId === "github" && String(a.accountId) === policy.adminGithubId)
  ) {
    return true;
  }
  return (
    policy.e2e &&
    E2E_ADMIN_EMAILS.includes(user.email.toLowerCase()) &&
    accounts.some((a) => a.providerId === "credential")
  );
}

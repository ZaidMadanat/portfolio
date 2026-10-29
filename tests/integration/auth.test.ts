import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, isAdminUser } from "@/lib/auth";
import { E2E_ADMIN_EMAIL, E2E_INTRUDER_EMAIL, NOT_ADMIN_MESSAGE } from "@/lib/auth-policy";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The real Better Auth instance against the test database. GitHub's OAuth round
// trip can't run here, so the GitHub cases drive the same gates directly: the
// identity check Better Auth calls with the raw GitHub profile, and the session
// gate that every sign-in passes through.

const ZAID = "4242424";
const PASSWORD = "e2e-password-not-a-secret";
// Locally the base URL comes from the request's host (src/lib/auth.ts).
const headers = () => new Headers({ host: "localhost:3100" });

beforeEach(resetDb);

async function forbidden(promise: Promise<unknown>) {
  const err = (await promise.then(
    () => null,
    (e: unknown) => e,
  )) as { statusCode?: number; body?: { code?: string; message?: string } } | null;
  expect(err, "expected the call to be rejected").not.toBeNull();
  expect(err?.statusCode).toBe(403);
  expect(err?.body?.code).toBe("NOT_ADMIN");
  expect(err?.body?.message).toBe(NOT_ADMIN_MESSAGE);
}

async function githubUser(githubId: string) {
  return db.user.create({
    data: {
      id: `u-${githubId}`,
      name: "Someone",
      email: `${githubId}@users.noreply.github.com`,
      emailVerified: true,
      accounts: { create: { id: `a-${githubId}`, providerId: "github", accountId: githubId } },
    },
  });
}

describe("production config (GitHub only)", () => {
  const auth = createAuth({ adminGithubId: ZAID, e2e: false });

  it("has no email+password sign-in", async () => {
    await expect(
      auth.api.signUpEmail({ headers: headers(), body: { email: E2E_ADMIN_EMAIL, password: PASSWORD, name: "Admin" } }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.user.count()).toBe(0);
  });

  it("the identity gate allows only the admin's numeric GitHub id", async () => {
    const validate = auth.options.user!.validateUserInfo!;
    const source = (profile: Record<string, unknown>) => ({ method: "oauth", action: "create-user", oauth: { providerId: "github", profile } }) as const;
    expect(await validate({ user: {}, source: source({ id: Number(ZAID), login: "ZaidMadanat" }) })).toBeUndefined();
    expect(await validate({ user: {}, source: source({ id: 7, login: "ZaidMadanat" }) })).toMatchObject({
      error: "NOT_ADMIN",
    });
  });

  it("creates a session for the admin's GitHub account and refuses one for anyone else", async () => {
    const ctx = await auth.$context;
    const zaid = await githubUser(ZAID);
    const session = await ctx.internalAdapter.createSession(zaid.id);
    expect(session?.userId).toBe(zaid.id);

    const other = await githubUser("999");
    await forbidden(ctx.internalAdapter.createSession(other.id));
    expect(await db.session.count({ where: { userId: other.id } })).toBe(0);
  });

  it("isAdminUser re-checks the linked accounts", async () => {
    const zaid = await githubUser(ZAID);
    const other = await githubUser("999");
    expect(await isAdminUser(zaid.id, { adminGithubId: ZAID, e2e: false })).toBe(true);
    expect(await isAdminUser(other.id, { adminGithubId: ZAID, e2e: false })).toBe(false);
    expect(await isAdminUser(zaid.id, { adminGithubId: "1", e2e: false })).toBe(false);
    expect(await isAdminUser("missing", { adminGithubId: ZAID, e2e: false })).toBe(false);
  });
});

describe("e2e config (E2E_AUTH=1)", () => {
  const auth = createAuth({ adminGithubId: null, e2e: true });
  const signUp = (email: string) => auth.api.signUpEmail({ headers: headers(), body: { email, password: PASSWORD, name: email } });
  const signIn = (email: string) => auth.api.signInEmail({ headers: headers(), body: { email, password: PASSWORD } });

  it("the test admin signs up (and is signed straight in), then signs in again", async () => {
    await signUp(E2E_ADMIN_EMAIL);
    expect(await db.session.count()).toBe(1);
    const res = await signIn(E2E_ADMIN_EMAIL);
    expect(res.user.email).toBe(E2E_ADMIN_EMAIL);
    expect(await db.session.count()).toBe(2);
    expect(await isAdminUser(res.user.id, { adminGithubId: null, e2e: true })).toBe(true);
    expect(await isAdminUser(res.user.id, { adminGithubId: null, e2e: false })).toBe(false);
  });

  it("the intruder can exist but can never get a session", async () => {
    await forbidden(signUp(E2E_INTRUDER_EMAIL));
    expect(await db.user.count()).toBe(1);
    await forbidden(signIn(E2E_INTRUDER_EMAIL));
    expect(await db.session.count()).toBe(0);
  });

  it("any other address is refused before a user row is created", async () => {
    await forbidden(signUp("someone@example.com"));
    expect(await db.user.count()).toBe(0);
  });
});

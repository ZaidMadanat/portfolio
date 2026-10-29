import { describe, expect, it } from "vitest";
import {
  authPolicyFromEnv,
  E2E_ADMIN_EMAIL,
  E2E_INTRUDER_EMAIL,
  githubIdOf,
  isAdminAccount,
  NOT_ADMIN_MESSAGE,
  validateIdentity,
  type AuthPolicy,
} from "@/lib/auth-policy";

const ZAID = "4242424";
const prod: AuthPolicy = { adminGithubId: ZAID, e2e: false };
const e2e: AuthPolicy = { adminGithubId: null, e2e: true };

const github = (profile: Record<string, unknown>, action: "create-user" | "sign-in" | "link-account" = "create-user") => ({
  user: { email: "someone@example.com" },
  source: { method: "oauth", action, oauth: { providerId: "github", profile } },
});
const password = (email: string) => ({
  user: { email },
  source: { method: "email-password", action: "create-user" as const },
});

describe("githubIdOf", () => {
  it("reads the numeric id GitHub returns, as a string", () => {
    expect(githubIdOf({ id: 4242424 })).toBe("4242424");
    expect(githubIdOf({ id: "4242424" })).toBe("4242424");
  });

  it("refuses anything that isn't a positive whole number", () => {
    for (const id of [undefined, null, "", "ZaidMadanat", "12a", 1.5, -3, 0, Number.NaN, {}]) {
      expect(githubIdOf({ id })).toBeNull();
    }
    expect(githubIdOf(undefined)).toBeNull();
  });
});

describe("validateIdentity (runs before a user is created, linked or signed in)", () => {
  it("allows only the GitHub account whose numeric id is ADMIN_GITHUB_ID", () => {
    expect(validateIdentity(github({ id: Number(ZAID), login: "ZaidMadanat" }), prod)).toBeUndefined();
    for (const action of ["sign-in", "link-account"] as const) {
      expect(validateIdentity(github({ id: Number(ZAID) }, action), prod)).toBeUndefined();
    }
  });

  it("ignores the login: a matching login with another id is rejected", () => {
    const res = validateIdentity(github({ id: 999, login: ZAID }), { adminGithubId: ZAID, e2e: false });
    expect(res).toEqual({ error: "NOT_ADMIN", errorDescription: NOT_ADMIN_MESSAGE });
    expect(validateIdentity(github({ login: "ZaidMadanat" }), prod)?.error).toBe("NOT_ADMIN");
  });

  it("rejects every GitHub account when ADMIN_GITHUB_ID is unset", () => {
    expect(validateIdentity(github({ id: Number(ZAID) }), { adminGithubId: null, e2e: false })?.error).toBe(
      "NOT_ADMIN",
    );
  });

  it("rejects other OAuth providers even with a matching id", () => {
    const res = validateIdentity(
      { user: {}, source: { method: "oauth", action: "create-user", oauth: { providerId: "google", profile: { id: ZAID } } } },
      prod,
    );
    expect(res?.error).toBe("NOT_ADMIN");
  });

  it("rejects email+password outside e2e, even for the e2e addresses", () => {
    expect(validateIdentity(password(E2E_ADMIN_EMAIL), prod)?.error).toBe("NOT_ADMIN");
  });

  it("in e2e allows only the two test accounts to exist", () => {
    expect(validateIdentity(password(E2E_ADMIN_EMAIL), e2e)).toBeUndefined();
    expect(validateIdentity(password("Admin@E2E.test"), e2e)).toBeUndefined();
    expect(validateIdentity(password(E2E_INTRUDER_EMAIL), e2e)).toBeUndefined();
    expect(validateIdentity(password("zaidsmadanat@gmail.com"), e2e)?.error).toBe("NOT_ADMIN");
  });

  it("rejects any other method", () => {
    const res = validateIdentity({ user: { email: E2E_ADMIN_EMAIL }, source: { method: "magic-link", action: "create-user" } }, e2e);
    expect(res?.error).toBe("NOT_ADMIN");
  });
});

describe("isAdminAccount (runs before a session is created, and on every admin request)", () => {
  it("is true only for a linked GitHub account with the admin's numeric id", () => {
    expect(isAdminAccount({ email: "x@example.com" }, [{ providerId: "github", accountId: ZAID }], prod)).toBe(true);
    expect(isAdminAccount({ email: "x@example.com" }, [{ providerId: "github", accountId: "999" }], prod)).toBe(false);
    expect(isAdminAccount({ email: "x@example.com" }, [{ providerId: "google", accountId: ZAID }], prod)).toBe(false);
    expect(isAdminAccount({ email: "x@example.com" }, [], prod)).toBe(false);
    expect(
      isAdminAccount({ email: "x@example.com" }, [{ providerId: "github", accountId: ZAID }], { adminGithubId: null, e2e: false }),
    ).toBe(false);
  });

  it("never trusts an email outside e2e", () => {
    expect(isAdminAccount({ email: E2E_ADMIN_EMAIL }, [{ providerId: "credential", accountId: "u1" }], prod)).toBe(false);
  });

  it("in e2e marks only the test admin's password account as admin", () => {
    const cred = [{ providerId: "credential", accountId: "u1" }];
    expect(isAdminAccount({ email: E2E_ADMIN_EMAIL }, cred, e2e)).toBe(true);
    expect(isAdminAccount({ email: E2E_INTRUDER_EMAIL }, cred, e2e)).toBe(false);
    expect(isAdminAccount({ email: E2E_ADMIN_EMAIL }, [], e2e)).toBe(false);
  });
});

describe("authPolicyFromEnv", () => {
  it("reads ADMIN_GITHUB_ID and leaves e2e off by default", () => {
    expect(authPolicyFromEnv({ ADMIN_GITHUB_ID: ZAID })).toEqual({ adminGithubId: ZAID, e2e: false });
    expect(authPolicyFromEnv({})).toEqual({ adminGithubId: null, e2e: false });
    expect(authPolicyFromEnv({ ADMIN_GITHUB_ID: "ZaidMadanat" }).adminGithubId).toBeNull();
  });

  it("enables e2e auth for E2E_AUTH=1, including under next start (NODE_ENV=production)", () => {
    expect(authPolicyFromEnv({ E2E_AUTH: "1", NODE_ENV: "production" }).e2e).toBe(true);
  });

  it("refuses to start with E2E_AUTH on Vercel (preview or production)", () => {
    expect(() => authPolicyFromEnv({ E2E_AUTH: "1", VERCEL: "1" })).toThrow(/E2E_AUTH/);
    expect(() => authPolicyFromEnv({ E2E_AUTH: "1", VERCEL_ENV: "preview" })).toThrow(/E2E_AUTH/);
    expect(() => authPolicyFromEnv({ E2E_AUTH: "0", VERCEL: "1" })).toThrow(/E2E_AUTH/);
  });
});

import { expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../src/lib/auth-policy";
import { EMPTY_URL, SEEDED_URL } from "./servers";

/** Password of the e2e test accounts (E2E_AUTH=1 only; not a secret). */
export const E2E_PASSWORD = "e2e-password-not-a-secret";

/**
 * Signs the page's browser context in as the e2e admin through the auth API
 * (the sign-in form itself is covered by admin-auth.spec.ts).
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: SEEDED_URL },
    data: { email: E2E_ADMIN_EMAIL, password: E2E_PASSWORD },
  });
  expect(res.ok(), `admin sign-in: ${res.status()}`).toBe(true);
}

/**
 * Signs in as the e2e admin on the empty-database server, creating the
 * account there first if needed (the setup project only creates it on the
 * seeded server). The session cookie is set for localhost, so in this browser
 * context it replaces any session on the seeded server.
 */
export async function signInAsAdminOnEmpty(page: Page): Promise<void> {
  const headers = { origin: EMPTY_URL };
  const signUp = await page.request.post(`${EMPTY_URL}/api/auth/sign-up/email`, {
    headers,
    data: { email: E2E_ADMIN_EMAIL, password: E2E_PASSWORD, name: "Test Admin" },
  });
  if (signUp.ok()) return;
  // Already there (or the other project created it a moment ago): sign in.
  const signIn = await page.request.post(`${EMPTY_URL}/api/auth/sign-in/email`, {
    headers,
    data: { email: E2E_ADMIN_EMAIL, password: E2E_PASSWORD },
  });
  expect(signIn.ok(), `admin sign-in on the empty server: ${signIn.status()}`).toBe(true);
}

import { expect, test as setup } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_INTRUDER_EMAIL } from "../src/lib/auth-policy";
import { E2E_PASSWORD } from "./support/admin";
import { SEEDED_URL } from "./support/servers";

// Runs once before the chromium and mobile projects (playwright.config.ts).
// Creates both e2e test accounts through the real sign-up endpoint, which signs
// a new user straight in: the admin gets a session, the intruder's row is
// created but its session is refused (403 NOT_ADMIN). A reused local server
// keeps its database, so "already exists" is fine too.
setup("create the e2e admin and intruder accounts", async ({ request }) => {
  const accounts = [
    { email: E2E_ADMIN_EMAIL, name: "Test Admin", ok: [] as string[] },
    { email: E2E_INTRUDER_EMAIL, name: "Test Intruder", ok: ["NOT_ADMIN"] },
  ];
  for (const { email, name, ok } of accounts) {
    const res = await request.post("/api/auth/sign-up/email", {
      // Better Auth's CSRF check wants an Origin once the context holds a session cookie.
      headers: { origin: SEEDED_URL },
      data: { email, password: E2E_PASSWORD, name },
    });
    if (res.ok()) continue;
    const { code } = await res.json();
    expect([...ok, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"], `sign-up ${email}: ${res.status()}`).toContain(code);
  }
});

import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_INTRUDER_EMAIL } from "../src/lib/auth-policy";
import { E2E_PASSWORD as PASSWORD } from "./support/admin";
import { SEEDED_URL } from "./support/servers";

// The e2e servers run with E2E_AUTH=1 (e2e/support/web-server.ts), which turns
// on email+password sign-in for the two test accounts only; e2e/admin.setup.ts
// creates them. Real GitHub sign-in needs an OAuth app and can't run here.

const SIDEBAR = ["Dashboard", "Posts", "Reviews", "Favourites", "Photo library", "Templates", "Subscribers"];

const alert = (page: Page) => page.getByRole("main").getByRole("alert");

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in");
  const form = page.getByRole("form", { name: "Test sign-in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in with test account" }).click();
}

test.describe("admin auth", () => {
  test("a visitor going to /admin is sent to the sign-in page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "Admin sign-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  });

  test("deep admin links redirect too", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });

  test("a forged session cookie gets past the proxy but not the layout", async ({ page, context }) => {
    // The proxy accepts either cookie name; the layout checks it against the DB.
    await context.addCookies([{ name: "better-auth.session_token", value: "forged.token", url: SEEDED_URL }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(page.getByRole("heading", { name: /^(Morning|Afternoon|Evening), Zaid\.$/ })).toHaveCount(0);
  });

  test("the admin signs in and sees the dashboard shell", async ({ page }) => {
    await signIn(page, E2E_ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: /^(Morning|Afternoon|Evening), Zaid\.$/ })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link")).toHaveText(SIDEBAR);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Signed in as Test Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "View site" })).toHaveAttribute("href", "/");

    // Signed in, the sign-in page sends you straight back to the dashboard.
    await page.goto("/admin/sign-in");
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });

  test("an account that isn't the admin is rejected at sign-in", async ({ page, context }) => {
    await signIn(page, E2E_INTRUDER_EMAIL);
    await expect(alert(page)).toHaveText("This admin is private.");
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    const cookies = await context.cookies();
    expect(cookies.filter((c) => c.name.includes("session_token"))).toEqual([]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });

  test("a GitHub rejection lands on the same message", async ({ page }) => {
    await page.goto("/admin/sign-in?error=NOT_ADMIN");
    await expect(alert(page)).toHaveText("This admin is private.");
  });

  test("the auth API refuses to create any other account", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { origin: SEEDED_URL },
      data: { email: "someone@example.com", password: PASSWORD, name: "Someone" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("NOT_ADMIN");
  });

  test("an admin route without a session is 401", async ({ request }) => {
    const res = await request.post("/api/admin/media", {
      multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a photo") } },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  test("public pages stay free of auth cookies", async ({ page, context }) => {
    await page.goto("/");
    await page.goto("/blog");
    expect((await context.cookies()).filter((c) => c.name.includes("better-auth"))).toEqual([]);
  });
});

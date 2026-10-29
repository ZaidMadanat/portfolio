import { expect, test } from "@playwright/test";
import { SOCIAL_LINKS } from "../src/components/site/social-links";

test("header nav has Home, Blog, Reviews, Contact", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const name of ["Home", "Blog", "Reviews", "Contact"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(
    nav.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("theme toggle persists across navigation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-motion", "on");
  await expect(html).not.toHaveClass(/\bdark\b/);

  // The label only reads "Switch to ..." once the toggle has hydrated.
  await page.getByRole("button", { name: /switch to dark mode/i }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("button", { name: /switch to light mode/i }),
  ).toBeVisible();

  await page.goto("/contact");
  await expect(html).toHaveClass(/\bdark\b/);
});

test("footer has 5 social links", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("contentinfo").getByRole("link");
  await expect(links).toHaveCount(5);
  expect(SOCIAL_LINKS).toHaveLength(5);
  for (const { label, href } of SOCIAL_LINKS) {
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  }
});

test("no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

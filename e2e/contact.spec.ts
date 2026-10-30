import { expect, test, type Page } from "@playwright/test";
import { SOCIAL_LINKS } from "../src/components/site/social-links";

// Playwright's webServer inherits this env, so the build and the tests agree on
// whether a Cal.com link is configured. Locally it is unset.
const CAL_LINK = process.env.NEXT_PUBLIC_CALCOM_LINK?.trim();

function bookingCard(page: Page) {
  return page.getByRole("region", { name: "Book a chat" });
}

const noIframe = (page: Page) =>
  page.evaluate(() => !document.querySelector("iframe"));

test("shows the heading, intro, email button and 4 social rows", async ({ page }) => {
  await page.goto("/contact");
  await expect(page).toHaveTitle("Contact · Zaid Madanat");
  await expect(page.getByRole("heading", { level: 1, name: "Say hi." })).toBeVisible();
  await expect(page.getByText(/always open to discussing projects/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "zaidsmadanat@gmail.com", exact: true }),
  ).toHaveAttribute("href", "mailto:zaidsmadanat@gmail.com");

  const socials = page.getByRole("list", { name: "Social profiles" }).getByRole("link");
  await expect(socials).toHaveCount(4);
  const expected = [
    ["GitHub", "@ZaidMadanat"],
    ["LinkedIn", "zaid-madanat"],
    ["Letterboxd", "@itsMaday"],
    ["Strava", "Profile"],
  ] as const;
  for (const [i, [label, handle]] of expected.entries()) {
    const href = SOCIAL_LINKS.find((s) => s.label === label)?.href;
    await expect(socials.nth(i)).toHaveText(new RegExp(`${label}\\s*${handle}`));
    await expect(socials.nth(i)).toHaveAttribute("href", href!);
  }

  await expect(
    bookingCard(page).getByRole("heading", { name: "Book a chat" }),
  ).toBeVisible();
});

test("the Cal.com iframe is not in the DOM before the card scrolls into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.goto("/contact");
  await expect(bookingCard(page)).toBeAttached();
  await expect(bookingCard(page)).not.toBeInViewport();
  expect(await noIframe(page)).toBe(true);
});

test.describe("without NEXT_PUBLIC_CALCOM_LINK", () => {
  test.skip(!!CAL_LINK, "a Cal.com link is configured");

  test("the card shows an email fallback and never loads the embed", async ({ page }) => {
    const calRequests: string[] = [];
    page.on("request", (req) => {
      if (/(^|\.)cal\.com$/.test(new URL(req.url()).hostname)) calRequests.push(req.url());
    });

    await page.goto("/contact");
    const card = bookingCard(page);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText("Calendar coming soon. Email me to find a time.")).toBeVisible();
    await expect(card.getByRole("link", { name: /email me/i })).toHaveAttribute(
      "href",
      "mailto:zaidsmadanat@gmail.com",
    );
    // Not "networkidle": nav prefetches of not-yet-built routes stay open.
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);
    expect(await noIframe(page)).toBe(true);
    await expect(page.locator('script[src*="cal.com"]')).toHaveCount(0);
    expect(calRequests).toEqual([]);
  });
});

test.describe("with NEXT_PUBLIC_CALCOM_LINK", () => {
  test.skip(!CAL_LINK, "no Cal.com link configured");

  test("the embed mounts once the card scrolls into view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 640 });
    await page.goto("/contact");
    expect(await noIframe(page)).toBe(true);
    await bookingCard(page).scrollIntoViewIfNeeded();
    await expect(bookingCard(page).locator("iframe")).toBeAttached({ timeout: 15_000 });
  });
});

test("no horizontal scroll at 375px, light and dark", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1, name: "Say hi." })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  }
});

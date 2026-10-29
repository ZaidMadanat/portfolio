import { expect, test, type Page } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

// /reviews/film (spec §6.6) against the 12 seeded April logs. Ben-Hur is the
// one linked to a FILM review (10) and a published post; Yojimbo is unrated.

const cards = (page: Page) => page.getByRole("list", { name: "Film logs" }).getByRole("listitem");
const chips = (page: Page) => page.getByRole("group", { name: "Filter films" });
const stamps = (page: Page) => page.getByRole("list", { name: "Film logs" }).getByRole("img", { name: /out of 10$/ });

async function open(page: Page, base = "") {
  await page.goto(`${base}/reviews/film`);
  await expect(page.getByRole("heading", { level: 1, name: "What I've been watching" })).toBeVisible();
}

test.describe("film page, seeded database", () => {
  test("header with two stat tiles, three chips, and a card per log", async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle("Film · Zaid Madanat");
    const stats = page.getByRole("list", { name: "This month" }).getByRole("listitem");
    await expect(stats).toHaveCount(2);
    await expect(stats.nth(0)).toContainText(/films? in [A-Z][a-z]+/);
    await expect(stats.nth(1)).toContainText("average rating");

    await expect(chips(page).getByRole("button")).toHaveText(["All logs", "9 and up", "Has a review"]);
    await expect(chips(page).getByRole("button", { name: "All logs" })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(12);
    // Yojimbo is unrated: no stamp, no stars.
    await expect(stamps(page)).toHaveCount(11);
    const yojimbo = cards(page).filter({ hasText: "Yojimbo" });
    await expect(yojimbo.getByRole("img", { name: /out of 10/ })).toHaveCount(0);
    await expect(yojimbo).not.toContainText("★");

    const aviator = cards(page).filter({ hasText: "The Aviator" });
    await expect(aviator).toContainText("2004");
    await expect(aviator).toContainText("★★★★½");
    await expect(aviator).toContainText("Apr 24, 2026");
    await expect(aviator.getByRole("img", { name: "9 out of 10" })).toBeVisible();
  });

  test('"9 and up" shows only cards stamped 9 or 10', async ({ page }) => {
    await open(page);
    await chips(page).getByRole("button", { name: "9 and up" }).click();
    await expect(chips(page).getByRole("button", { name: "9 and up" })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(5);
    await expect(stamps(page)).toHaveCount(5);
    for (const name of await stamps(page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))) {
      expect(["9 out of 10", "10 out of 10"]).toContain(name);
    }
    await chips(page).getByRole("button", { name: "All logs" }).click();
    await expect(cards(page)).toHaveCount(12);
  });

  test('"Has a review" cards carry the REVIEW tag and link to the post', async ({ page }) => {
    await open(page);
    await chips(page).getByRole("button", { name: "Has a review" }).click();
    await expect(cards(page)).toHaveCount(1);
    const benHur = cards(page).first();
    await expect(benHur).toContainText("Ben-Hur");
    await expect(benHur.getByTestId("review-tag")).toHaveText(/review/i);
    await expect(benHur.getByRole("img", { name: "10 out of 10" })).toBeVisible();
    const link = benHur.getByRole("link", { name: "Ben-Hur" });
    await expect(link).toHaveAttribute("href", "/blog/ben-hur-sixty-seven-years-later");
    await link.click();
    await expect(page).toHaveURL(/\/blog\/ben-hur-sixty-seven-years-later$/);

    // Logs without a review have no tag and no link.
    await open(page);
    await expect(cards(page).filter({ hasText: "Lolita" }).getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("review-tag")).toHaveCount(1);
  });

  test('no "Letterboxd" text in the page body (only the footer icon label)', async ({ page }) => {
    await open(page);
    expect(await page.locator("main").innerText()).not.toMatch(/letterboxd/i);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /Letterboxd/ })).toHaveCount(1);
  });
});

test.describe("film page, empty database", () => {
  test("stat tiles at zero, no chips, an empty state", async ({ page }) => {
    await open(page, EMPTY_URL);
    const stats = page.getByRole("list", { name: "This month" }).getByRole("listitem");
    await expect(stats.nth(0)).toContainText("0");
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByText("No films logged yet.")).toBeVisible();
  });
});

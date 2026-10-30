import { expect, test, type Page } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

const tiles = (page: Page) => page.getByRole("navigation", { name: "Review sections" }).getByRole("link");
const topList = (page: Page, name: string) => page.getByRole("list", { name, exact: true }).getByRole("listitem");

async function expectTiles(page: Page) {
  await expect(tiles(page)).toHaveCount(3);
  for (const [i, href] of ["/reviews/food", "/reviews/film", "/reviews/music"].entries()) {
    await expect(tiles(page).nth(i)).toHaveAttribute("href", href);
  }
}

test.describe("reviews hub, seeded database", () => {
  test("three tiles link to the sub-pages; Food shows the place count", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page).toHaveTitle("Reviews · Zaid Madanat");
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible();
    await expectTiles(page);
    await expect(tiles(page).nth(0)).toContainText("8 places");
    await expect(tiles(page).nth(0)).toContainText("Food");
    await expect(tiles(page).nth(1)).toContainText("Film");
    await expect(tiles(page).nth(2)).toContainText("Music");
    await expect(page.getByText(/stats\.fm|Letterboxd/)).toHaveCount(0);
  });

  test("top 4 films and top 4 albums come from favourites, in position order", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: "My top 4 films" })).toBeVisible();
    const films = topList(page, "My top 4 films");
    await expect(films).toHaveCount(4);
    await expect(films.nth(0)).toContainText("Ben-Hur (1959)");
    await expect(films.nth(0).getByRole("img", { name: "10 out of 10" })).toBeVisible();
    await expect(films.nth(3)).toContainText("The Aviator (2004)");

    await expect(page.getByRole("heading", { name: "My top 4 albums" })).toBeVisible();
    const albums = topList(page, "My top 4 albums");
    await expect(albums).toHaveCount(4);
    await expect(albums.nth(1)).toContainText("Blonde");
    await expect(albums.nth(1)).toContainText("Frank Ocean");
  });

  test("latest reviews lists the 6 newest across kinds with kind-specific meta", async ({ page }) => {
    await page.goto("/reviews");
    const rows = page.getByRole("list", { name: "Latest reviews" }).getByRole("link");
    await expect(rows).toHaveCount(6);

    await expect(rows.nth(0)).toContainText("Film");
    await expect(rows.nth(0)).toContainText("Ben-Hur");
    await expect(rows.nth(0)).toContainText("Watched Apr 26");
    await expect(rows.nth(0)).toHaveAttribute("href", "/blog/ben-hur-sixty-seven-years-later");
    await expect(rows.nth(0).getByRole("img", { name: "10 out of 10" })).toBeVisible();

    await expect(rows.nth(1)).toContainText("Cheese Board Pizza");
    await expect(rows.nth(1)).toContainText("Pizza · $ · North Berkeley, Berkeley");
    await expect(rows.nth(1)).toHaveAttribute("href", "/reviews/food");
    await expect(rows.nth(1).getByRole("img", { name: "9 out of 10" })).toBeVisible();
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/reviews");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("reviews hub, empty database", () => {
  test("tiles stay, top-4 sections hide for visitors, latest reviews shows an empty state", async ({
    page,
  }) => {
    await page.goto(`${EMPTY_URL}/reviews`);
    await expectTiles(page);
    await expect(tiles(page).nth(0)).not.toContainText("places");
    await expect(page.getByRole("heading", { name: /My top 4/ })).toHaveCount(0);
    // The "Pick your top 4 in the admin" prompt is for a signed-in admin only (Task 17+).
    await expect(page.getByText(/Pick your top 4/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Latest reviews" })).toBeVisible();
    await expect(page.getByText("No reviews yet.")).toBeVisible();
  });
});

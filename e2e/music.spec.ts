import { expect, test, type Page } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

// /reviews/music (spec §6.7) against the seeded stats.fm window (6 albums),
// 4 ALBUM reviews (Kid A linked to a published post) and 2 CONCERT reviews.

const pills = (page: Page) => page.getByRole("navigation", { name: "Music sections" }).getByRole("link");
const section = (page: Page, name: string) => page.getByRole("region", { name });
const rated = (page: Page) => page.getByRole("list", { name: "Rated albums" }).getByRole("listitem");
const concerts = (page: Page) => section(page, "Concerts").getByRole("article");

async function open(page: Page, base = "") {
  await page.goto(`${base}/reviews/music`);
  await expect(page.getByRole("heading", { level: 1, name: "What's in my ears" })).toBeVisible();
}

test.describe("music page, seeded database", () => {
  test("the anchor pills scroll to each section", async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle("Music · Zaid Madanat");
    await expect(pills(page)).toHaveText(["Recent", "Rated albums", "Concerts"]);
    for (const [name, id, heading] of [
      ["Concerts", "concerts", "Concerts"],
      ["Rated albums", "rated", "Rated albums"],
      ["Recent", "recent", "On rotation this week"],
    ]) {
      await expect(pills(page).filter({ hasText: name })).toHaveAttribute("href", `#${id}`);
      await pills(page).filter({ hasText: name }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
      await expect(section(page, heading)).toHaveAttribute("id", id);
    }
  });

  test("on rotation: up to 6 albums by rank", async ({ page }) => {
    await open(page);
    const albums = page.getByRole("list", { name: "On rotation this week" }).getByRole("listitem");
    await expect(albums).toHaveCount(6);
    await expect(albums.nth(0)).toContainText("Marty Supreme (Original Soundtrack)");
    await expect(albums.nth(0)).toContainText("Daniel Lopatin");
    await expect(albums.nth(5)).toContainText("IGOR");
  });

  test("rated albums: by rating, then date; Read review only when a post is linked", async ({ page }) => {
    await open(page);
    await expect(rated(page)).toHaveCount(4);
    const titles = await rated(page).locator("h3").allInnerTexts();
    expect(titles).toEqual(["Kid A", "Channel Orange", "Chromakopia", "Brat"]);
    await expect(rated(page).nth(0)).toContainText("Radiohead · 2000");
    await expect(rated(page).nth(0).getByRole("img", { name: "10 out of 10" })).toBeVisible();
    await expect(rated(page).nth(0).getByRole("link", { name: /Read review/ })).toHaveAttribute(
      "href",
      "/blog/albums-on-repeat",
    );
    await expect(page.getByRole("link", { name: /Read review/ })).toHaveCount(1);
  });

  test("concert cards are ticket stubs with the rating in the stub", async ({ page }) => {
    await open(page);
    await expect(concerts(page)).toHaveCount(2);
    const first = concerts(page).nth(0);
    await expect(first.getByRole("heading", { name: "Khruangbin" })).toBeVisible();
    await expect(first).toContainText("Greek Theatre, Berkeley");
    await expect(first).toContainText("Oct 4, 2025");
    await expect(first).toContainText("the encore");
    const stub = first.getByTestId("ticket-stub");
    await expect(stub).toContainText("8");
    await expect(stub).toContainText("out of 10");
    await expect(stub.getByRole("img", { name: "8 out of 10" })).toBeVisible();
    await expect(concerts(page).nth(1).getByTestId("ticket-stub")).toContainText("9");
  });

  test('no "stats.fm" text in the page body', async ({ page }) => {
    await open(page);
    expect(await page.locator("main").innerText()).not.toMatch(/stats\.?fm/i);
  });
});

test.describe("music page, empty database", () => {
  test('"On rotation this week" is hidden, not an empty grid', async ({ page }) => {
    await open(page, EMPTY_URL);
    await expect(page.getByRole("heading", { name: "On rotation this week" })).toHaveCount(0);
    await expect(page.locator("#recent")).toHaveCount(0);
    await expect(pills(page)).toHaveCount(0);
    await expect(page.getByText("No music yet.")).toBeVisible();
  });
});

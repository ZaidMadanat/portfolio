import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";
import { sql } from "./support/db";

// The favourites admin (spec §7 Favourites): keyboard reordering with dnd-kit,
// Swap through the picker, and the reviews hub's top 4 updating on the next
// load (/reviews is prerendered, so this proves setFavorites expired its tag).
// It changes a public page, so it runs in the "writes" project and puts the
// seeded order back at the end.

const films = (page: Page) => page.getByRole("list", { name: "Top 4 films" }).getByTestId("favourite-title");
const albums = (page: Page) => page.getByRole("list", { name: "Top 4 albums" }).getByTestId("favourite-title");
const hubList = (page: Page, name: string) => page.getByRole("list", { name, exact: true }).getByRole("listitem");
const SEEDED_FILMS = ["Ben-Hur", "A Clockwork Orange", "Whisper of the Heart", "The Aviator"];

async function saved(page: Page, heading: string) {
  await expect(page.getByRole("region", { name: heading }).getByTestId("favourites-save-status")).toHaveText("Saved.");
}

/** Moves a film one step with dnd-kit's keyboard sensor, waiting for each announcement as a screen reader user would. */
async function moveFilm(page: Page, name: string, key: "ArrowDown" | "ArrowUp", to: number) {
  const live = page.getByRole("region", { name: "Top 4 films" }).locator('[id^="DndLiveRegion"]');
  await page.getByRole("button", { name: `Reorder ${name}` }).focus();
  await page.keyboard.press("Space");
  await expect(live).toContainText(`Picked up ${name}`);
  // dnd-kit's KeyboardSensor starts listening for arrow keys in a setTimeout
  // after the pick-up; let that run first (a person can't press that fast).
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press(key);
  await expect(live).toContainText(`${name} moved to position ${to} of 4.`);
  await page.keyboard.press("Space");
  await expect(live).toContainText(`${name} dropped at position ${to} of 4.`);
}

async function restoreSeededFilms() {
  // Positions are unique and checked 1–4, so rewrite the rows rather than shuffle them.
  const rows = await sql(`DELETE FROM "Favorite" WHERE kind = 'FILM' RETURNING *`);
  for (const r of rows) {
    const position = SEEDED_FILMS.indexOf(r.title) + 1;
    await sql(
      `INSERT INTO "Favorite" (id, kind, position, "filmLogId", "reviewId", title, artist, year, "coverUrl", "createdAt", "updatedAt") VALUES ($1, 'FILM', $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [r.id, position, r.filmLogId, r.reviewId, r.title, r.artist, r.year, r.coverUrl, r.createdAt],
    );
  }
}

async function filmTitles() {
  const rows = await sql<{ title: string }>(`SELECT title FROM "Favorite" WHERE kind = 'FILM' ORDER BY position`);
  return rows.map((r) => r.title);
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test("reorder films with the keyboard; the reviews hub follows on the next load", async ({ page }) => {
  await page.goto("/admin/favourites");
  await expect(page.getByRole("heading", { level: 1, name: "Favourites" })).toBeVisible();
  await expect(films(page)).toHaveText(SEEDED_FILMS);

  try {
    await moveFilm(page, "Ben-Hur (1959)", "ArrowDown", 2);
    await expect(films(page)).toHaveText(["A Clockwork Orange", "Ben-Hur", "Whisper of the Heart", "The Aviator"]);
    await saved(page, "Top 4 films");
    expect(await filmTitles()).toEqual(["A Clockwork Orange", "Ben-Hur", "Whisper of the Heart", "The Aviator"]);

    await page.goto("/reviews");
    await expect(hubList(page, "My top 4 films").nth(0)).toContainText("A Clockwork Orange");
    await expect(hubList(page, "My top 4 films").nth(1)).toContainText("Ben-Hur");

    // Put it back.
    await page.goto("/admin/favourites");
    await moveFilm(page, "Ben-Hur (1959)", "ArrowUp", 1);
    await expect(films(page)).toHaveText(SEEDED_FILMS);
    await saved(page, "Top 4 films");
  } finally {
    // Only after a failure: put the seeded order back directly (the static
    // /reviews page then stays stale until the next build).
    if ((await filmTitles()).join() !== SEEDED_FILMS.join()) await restoreSeededFilms();
  }
  await page.goto("/reviews");
  await expect(hubList(page, "My top 4 films").nth(0)).toContainText("Ben-Hur");
});

test("swap an album for one typed in, then back from this week's listening", async ({ page }) => {
  await page.goto("/admin/favourites");
  await expect(albums(page)).toHaveText(["Marty Supreme (Original Soundtrack)", "Blonde", "In Rainbows", "IGOR"]);

  await page.getByRole("button", { name: "Swap IGOR (2019)" }).click();
  const dialog = page.getByRole("dialog", { name: "Swap IGOR (2019)" });
  await expect(dialog).toBeVisible();
  // Already in the list: can't be picked twice.
  await expect(dialog.getByRole("button", { name: /^Blonde · Frank Ocean/ })).toBeDisabled();
  await dialog.getByLabel("Title").fill("GNX");
  await dialog.getByLabel("Artist").fill("Kendrick Lamar");
  await dialog.getByLabel("Year").fill("2024");
  await dialog.getByRole("button", { name: "Use this" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(albums(page).nth(3)).toHaveText("GNX");
  await saved(page, "Top 4 albums");

  await page.goto("/reviews");
  await expect(hubList(page, "My top 4 albums").nth(3)).toContainText("GNX");

  await page.goto("/admin/favourites");
  await page.getByRole("button", { name: "Swap GNX (2024)" }).click();
  const back = page.getByRole("dialog", { name: "Swap GNX (2024)" });
  await back.getByLabel("Search").fill("igor");
  await back.getByRole("button", { name: "IGOR · Tyler, The Creator" }).click();
  await expect(albums(page).nth(3)).toHaveText("IGOR");
  await saved(page, "Top 4 albums");
  const [igor] = await sql(`SELECT title, artist, year, "coverUrl", "filmLogId", "reviewId" FROM "Favorite" WHERE kind = 'ALBUM' AND position = 4`);
  expect(igor).toEqual({ title: "IGOR", artist: "Tyler, The Creator", year: 2019, coverUrl: null, filmLogId: null, reviewId: null });

  await page.goto("/reviews");
  await expect(hubList(page, "My top 4 albums").nth(3)).toContainText("IGOR");
});

import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";
import { sql } from "./support/db";

// The admin review form (spec §7 Reviews). The servers run with GEOCODE_FAKE=1,
// which knows exactly one address: "309 Clement St, San Francisco". Saving a
// review changes /reviews (latest reviews, the food count), so this spec runs
// in the "writes" project, after every other spec, and deletes what it creates
// through the admin list so the public pages are expired back.

const reviewIdFromUrl = (page: Page) => /\/admin\/reviews\/([a-z0-9]+)/.exec(page.url())?.[1] ?? "";

/** Deletes a review through the admin list (which expires the public pages). */
async function deleteThroughAdmin(page: Page, id: string) {
  await page.goto("/admin/reviews");
  const row = page.getByRole("listitem").filter({ has: page.locator(`a[href="/admin/reviews/${id}"]`) });
  await row.getByRole("button", { name: /^Delete / }).click();
  await row.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.locator(`a[href="/admin/reviews/${id}"]`)).toHaveCount(0);
}

async function cleanUp(page: Page, id: string) {
  if (!id) return;
  const [row] = await sql(`SELECT id FROM "Review" WHERE id = $1`, [id]);
  if (row) await deleteThroughAdmin(page, id);
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test("create a food review: geocoded address, region from the city, dishes, saved and listed", async ({ page }) => {
  let id = "";
  try {
    await page.goto("/admin/reviews/new?kind=FOOD");
    await expect(page.getByRole("heading", { level: 1, name: "New review" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Food" })).toHaveAttribute("aria-selected", "true");

    await page.getByLabel("Name", { exact: true }).fill("Burma Superstar");
    await page.getByLabel("Address", { exact: true }).fill("309 Clement St, San Francisco");
    await page.getByLabel("Address", { exact: true }).blur();
    await expect(page.getByTestId("geocode-status")).toHaveText("Found · Inner Richmond, San Francisco");
    await expect(page.getByLabel("Latitude")).toHaveValue("37.783");
    await expect(page.getByLabel("Longitude")).toHaveValue("-122.463");
    await expect(page.getByLabel("Neighbourhood")).toHaveValue("Inner Richmond");
    await expect(page.getByLabel("City", { exact: true })).toHaveValue("San Francisco");
    await expect(page.getByLabel("Region")).toHaveValue("SAN_FRANCISCO");

    await page.getByLabel("Cuisine").selectOption("Burmese");
    await page.getByRole("group", { name: "Price" }).getByRole("button", { name: "$$", exact: true }).click();
    await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: "8", exact: true }).click();

    await page.getByRole("textbox", { name: "Dish 1", exact: true }).fill("Tea leaf salad");
    await page.getByRole("button", { name: "+ Add dish" }).click();
    await page.getByRole("textbox", { name: "Dish 2", exact: true }).fill("Samusa soup");
    await expect(page.getByRole("button", { name: "Must order: Tea leaf salad" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Must order: Samusa soup" })).toHaveAttribute("aria-pressed", "false");

    const preview = page.getByRole("complementary", { name: "Live preview" });
    await expect(preview).toContainText("Burma Superstar");
    await expect(preview).toContainText("Burmese · $$ · Inner Richmond, San Francisco");
    await expect(preview.getByRole("img", { name: "8 out of 10" })).toBeVisible();

    await page.getByRole("button", { name: "Save review" }).click();
    await expect(page).toHaveURL(/\/admin\/reviews\/[a-z0-9]+\?saved=1$/);
    id = reviewIdFromUrl(page);
    await expect(page.getByRole("status").filter({ hasText: "Review saved." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Edit review" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Burma Superstar");
    await expect(page.getByRole("textbox", { name: "Dish 2", exact: true })).toHaveValue("Samusa soup");

    const [stored] = await sql<{ kind: string; rating: number; price: number; cuisine: string; region: string; lat: number; lng: number; city: string; neighbourhood: string }>(
      `SELECT kind, rating, price, cuisine, region, lat, lng, city, neighbourhood FROM "Review" WHERE id = $1`,
      [id],
    );
    expect(stored).toEqual({
      kind: "FOOD",
      rating: 8,
      price: 2,
      cuisine: "Burmese",
      region: "SAN_FRANCISCO",
      lat: 37.783,
      lng: -122.463,
      city: "San Francisco",
      neighbourhood: "Inner Richmond",
    });
    const dishes = await sql<{ name: string; mustOrder: boolean }>(
      `SELECT name, "mustOrder" FROM "Dish" WHERE "reviewId" = $1 ORDER BY "order"`,
      [id],
    );
    expect(dishes).toEqual([
      { name: "Tea leaf salad", mustOrder: true },
      { name: "Samusa soup", mustOrder: false },
    ]);

    await page.goto("/admin/reviews?kind=FOOD");
    const row = page.getByRole("listitem").filter({ has: page.locator(`a[href="/admin/reviews/${id}"]`) });
    await expect(row).toContainText("Burma Superstar");
    await expect(row.getByRole("img", { name: "8 out of 10" })).toBeVisible();

    // Public: /reviews/food is static, and the save expired it, so the next
    // load lists the new place beside the seeded Burma Superstar. (No total
    // count: other "writes" specs add and remove places at the same time.)
    await page.goto("/reviews/food");
    const places = page.getByRole("list", { name: "Places" }).getByRole("listitem");
    await expect(places.filter({ hasText: "Burma Superstar" })).toHaveCount(2);
    await expect(page.getByTestId("food-map").getByRole("button", { name: "Burma Superstar, 8 out of 10" })).toHaveCount(2);
  } finally {
    await cleanUp(page, id);
  }
});

test("switching tabs keeps the shared fields; a film log prefills the rating", async ({ page }) => {
  const [aviator] = await sql<{ id: string }>(`SELECT id FROM "FilmLog" WHERE title = 'The Aviator'`);
  await page.goto("/admin/reviews/new?kind=FILM");
  await expect(page.getByRole("tab", { name: "Film" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("combobox", { name: "Film", exact: true }).selectOption(aviator.id);
  const rating = page.getByRole("group", { name: "Rating" });
  // ★★★★½ → 9
  await expect(rating.getByRole("button", { name: "9", exact: true })).toHaveAttribute("aria-pressed", "true");
  await rating.getByRole("button", { name: "7", exact: true }).click();
  await page.getByLabel("Date").fill("2026-10-01");

  await page.getByRole("tab", { name: "Concert" }).click();
  await expect(page.getByLabel("Artist")).toBeVisible();
  await expect(rating.getByRole("button", { name: "7", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Date")).toHaveValue("2026-10-01");
  await page.getByLabel("Artist").fill("Khruangbin");

  await page.getByRole("tab", { name: "Food" }).click();
  await expect(rating.getByRole("button", { name: "7", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Date")).toHaveValue("2026-10-01");

  await page.getByRole("tab", { name: "Film" }).click();
  await expect(page.getByRole("combobox", { name: "Film", exact: true })).toHaveValue(aviator.id);
  await expect(rating.getByRole("button", { name: "7", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Concert" }).click();
  await expect(page.getByLabel("Artist")).toHaveValue("Khruangbin");
});

test("an unknown address asks for the pin; an unmapped city needs a region; errors show inline", async ({ page }) => {
  await page.goto("/admin/reviews/new");
  await expect(page.getByRole("tab", { name: "Food" })).toHaveAttribute("aria-selected", "true");

  await page.getByLabel("Address", { exact: true }).fill("1 Nowhere Lane, Atlantis");
  await page.getByLabel("Address", { exact: true }).blur();
  await expect(page.getByTestId("geocode-status")).toHaveText("Couldn't find that address. Drop the pin on the map instead.");
  await expect(page.getByLabel("Latitude")).toHaveValue("");

  await page.getByLabel("City", { exact: true }).fill("Berkeley");
  await expect(page.getByLabel("Region")).toHaveValue("EAST_BAY");
  await page.getByLabel("City", { exact: true }).fill("Pacifica");
  await expect(page.getByLabel("Region")).toHaveValue("");
  await expect(page.getByText("This city isn't on the region list, so pick the closest one.")).toBeVisible();

  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Some fields need a look before this can be saved." })).toBeVisible();
  await expect(page.getByText("Add a name.")).toBeVisible();
  await expect(page.getByText("Pick a rating from 1 to 10.")).toBeVisible();
  await expect(page.getByText("Find the address or place the pin.").first()).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/admin\/reviews\/new$/);

  // Typing coordinates by hand works without the map.
  await page.getByLabel("Latitude").fill("37.59");
  await page.getByLabel("Longitude").fill("-122.5");
  await expect(page.getByLabel("Latitude")).toHaveValue("37.59");
});

test("“Write one now” saves the review, starts a draft from its template and opens the editor", async ({ page }) => {
  let id = "";
  let postId = "";
  try {
    await page.goto("/admin/reviews/new?kind=CONCERT");
    await page.getByLabel("Artist").fill("Khruangbin");
    await page.getByLabel("Venue").fill("Greek Theatre, Berkeley");
    await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: "9", exact: true }).click();
    await page.getByRole("button", { name: "Write one now" }).click();

    await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
    postId = /\/admin\/posts\/([a-z0-9]+)/.exec(page.url())?.[1] ?? "";
    const settings = page.getByRole("complementary", { name: "Post settings" });
    await expect(settings.getByLabel("Template")).toHaveValue("builtin-concert");
    const [post] = await sql<{ reviewId: string; templateId: string; title: string }>(
      `SELECT "reviewId", "templateId", title FROM "Post" WHERE id = $1`,
      [postId],
    );
    id = post.reviewId;
    expect(post).toMatchObject({ templateId: "builtin-concert", title: "Khruangbin" });
    await expect(settings.getByLabel("Linked review")).toHaveValue(id);
  } finally {
    // The draft was never public; remove it directly, then the review through the admin.
    if (postId) await sql(`DELETE FROM "Post" WHERE id = $1`, [postId]);
    await cleanUp(page, id);
  }
});

test("delete a review from its edit page: confirm, back to the list, gone from admin and /reviews/food", async ({ page }) => {
  const name = "Delete Me Diner";
  let id = "";
  try {
    await page.goto("/admin/reviews/new?kind=FOOD");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Address", { exact: true }).fill("309 Clement St, San Francisco");
    await page.getByLabel("Address", { exact: true }).blur();
    await expect(page.getByLabel("Region")).toHaveValue("SAN_FRANCISCO");
    await page.getByLabel("Cuisine").selectOption("Thai");
    await page.getByRole("group", { name: "Price" }).getByRole("button", { name: "$", exact: true }).click();
    await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("textbox", { name: "Dish 1", exact: true }).fill("Pad see ew");
    await page.getByRole("button", { name: "Save review" }).click();
    await expect(page).toHaveURL(/\/admin\/reviews\/[a-z0-9]+\?saved=1$/);
    id = reviewIdFromUrl(page);

    const places = page.getByRole("list", { name: "Places" }).getByRole("listitem");
    await page.goto("/reviews/food");
    await expect(places.filter({ hasText: name })).toHaveCount(1);

    await page.goto(`/admin/reviews/${id}`);
    await page.getByRole("button", { name: "Delete review" }).click();
    await expect(page.getByText("Delete this review? This can't be undone.")).toBeVisible();
    // Cancel keeps it.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Delete review" })).toBeVisible();
    expect(await sql(`SELECT id FROM "Review" WHERE id = $1`, [id])).toHaveLength(1);

    await page.getByRole("button", { name: "Delete review" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page).toHaveURL(/\/admin\/reviews$/);
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible();
    await expect(page.locator(`a[href="/admin/reviews/${id}"]`)).toHaveCount(0);
    expect(await sql(`SELECT id FROM "Review" WHERE id = $1`, [id])).toHaveLength(0);
    expect(await sql(`SELECT id FROM "Dish" WHERE "reviewId" = $1`, [id])).toHaveLength(0);

    await page.goto("/reviews/food");
    await expect(places.filter({ hasText: "Cheese Board Pizza" })).toHaveCount(1);
    await expect(places.filter({ hasText: name })).toHaveCount(0);
    await expect(page.getByTestId("food-map").getByRole("button", { name: `${name}, 5 out of 10` })).toHaveCount(0);
  } finally {
    await cleanUp(page, id);
  }
});

import { expect, test, type Page } from "@playwright/test";
import { showFoodMap } from "./support/food";
import { EMPTY_URL } from "./support/servers";

// /reviews/food (spec §6.5) against the 8 seeded places. Map tiles come from
// OpenFreeMap; every test but the last blocks them, so nothing here depends
// on the network, and the last one proves the page copes when they're down.

const TILES = "**/tiles.openfreemap.org/**";

const map = (page: Page) => page.getByTestId("food-map");
const pins = (page: Page) => map(page).getByRole("button", { name: /, \d+ out of 10$/ });
const rows = (page: Page) => page.getByRole("list", { name: "Places" }).getByRole("listitem");
const filters = (page: Page) => page.getByRole("search", { name: "Filter places" });

async function open(page: Page, path = "/reviews/food") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Food" })).toBeVisible();
  await showFoodMap(page);
  await expect(map(page).locator("canvas.maplibregl-canvas")).toBeVisible();
}

async function chooseCuisines(page: Page, names: string[]) {
  await filters(page).getByRole("button", { name: /^All cuisines/ }).click();
  const panel = page.getByRole("group", { name: "Cuisines" });
  for (const name of names) await panel.getByRole("checkbox", { name: new RegExp(`^${name}\\b`) }).check();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
}

test.describe("food map, seeded database", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(TILES, (route) => route.abort());
  });

  test("a same-size placeholder stands in for the map until MapLibre loads", async ({ browser, page }) => {
    // Without JavaScript the static HTML is all there is: placeholder, list, no pins.
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const still = await noJs.newPage();
    await still.goto("/reviews/food");
    await expect(still.getByTestId("map-placeholder")).toBeVisible();
    await expect(still.locator("canvas")).toHaveCount(0);
    await expect(rows(still)).toHaveCount(8);
    const placeholderBox = await still.getByTestId("map-placeholder").boundingBox();
    await noJs.close();

    await open(page);
    await expect(page.getByTestId("map-placeholder")).toHaveCount(0);
    const mapBox = await map(page).boundingBox();
    expect(mapBox?.height).toBe(placeholderBox?.height);
    expect(mapBox?.width).toBe(placeholderBox?.width);
    await expect(pins(page)).toHaveCount(8);
    // Pins drop in, staggered (motion.css), and carry the name and rating.
    const first = page.getByRole("button", { name: "Cheese Board Pizza, 9 out of 10" });
    await expect(first).toHaveClass(/\bpin-drop\b/);
    await expect(first).toHaveAttribute("style", /--i:\s*0/);
    await expect(first).toHaveAttribute("aria-pressed", "false");
    // The required map credit, small (no decorative source labels).
    await expect(map(page).locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  });

  test("on a phone, MapLibre loads only once the map scrolls near the viewport", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "the map starts below the fold only on a phone");
    const maplibre: string[] = [];
    page.on("request", (req) => {
      if (/maplibre/i.test(req.url())) maplibre.push(req.url());
    });
    await page.goto("/reviews/food");
    await expect(rows(page)).toHaveCount(8);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("map-placeholder")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(maplibre).toEqual([]);
    // The list and filters work without the map.
    await rows(page).filter({ hasText: "Comal" }).getByRole("button").click();
    await expect(page.getByRole("article", { name: "Comal" })).toBeVisible();

    await showFoodMap(page);
    await expect(map(page).locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(pins(page)).toHaveCount(8);
    // The place picked before the map loaded is selected on it.
    await expect(page.getByRole("button", { name: "Comal, 6 out of 10" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the list is every place, newest first", async ({ page }) => {
    await open(page);
    await expect(page.getByText("8 places", { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(8);
    await expect(rows(page).nth(0)).toContainText("Cheese Board Pizza");
    await expect(rows(page).nth(0)).toContainText("Pizza · $ · North Berkeley, Berkeley");
    await expect(rows(page).nth(0)).toContainText("Apr 4, 2026");
    await expect(rows(page).nth(7)).toContainText("Zachary's Chicago Pizza");
  });

  test("cuisine multi-select: Mexican + Pizza shows 4, as chips that can be removed", async ({ page }) => {
    await open(page);
    await filters(page).getByRole("button", { name: /^All cuisines/ }).click();
    const panel = page.getByRole("group", { name: "Cuisines" });
    await expect(panel.getByRole("checkbox")).toHaveCount(19);
    await expect(panel.getByText("Burmese")).toBeVisible();
    await page.keyboard.press("Escape");

    await chooseCuisines(page, ["Mexican", "Pizza"]);
    await expect(filters(page).getByRole("button", { name: /^2 cuisines/ })).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
    await expect(pins(page)).toHaveCount(4);
    await expect(page.getByText("4 places", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?cuisine=Mexican&cuisine=Pizza$/);

    await filters(page).getByRole("button", { name: "Remove Pizza" }).click();
    await expect(rows(page)).toHaveCount(2);
    await filters(page).getByRole("button", { name: "Clear cuisines" }).click();
    await expect(rows(page)).toHaveCount(8);
  });

  test("price, region and rating bands combine; a shared URL restores them", async ({ page }) => {
    await open(page);
    await filters(page).getByRole("group", { name: "Region" }).getByRole("button", { name: "East Bay" }).click();
    await expect(rows(page)).toHaveCount(3);
    await filters(page).getByRole("group", { name: "Price" }).getByRole("button", { name: "$$", exact: true }).click();
    await expect(rows(page)).toHaveCount(2);
    await filters(page).getByRole("group", { name: "Rating" }).getByRole("button", { name: "6 and under" }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).nth(0)).toContainText("Comal");
    await expect(pins(page)).toHaveCount(1);

    await page.goto("/reviews/food?region=EAST_BAY&rating=8%2B");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).nth(0)).toContainText("Cheese Board Pizza");
    await expect(filters(page).getByRole("button", { name: "8 and up" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a filter that matches nothing shows the empty state with Clear, and no stale pins", async ({ page }) => {
    await open(page);
    await expect(pins(page)).toHaveCount(8);
    await filters(page).getByRole("group", { name: "Region" }).getByRole("button", { name: "North Bay" }).click();
    await expect(page.getByText("No places match yet.")).toBeVisible();
    await expect(page.locator('[aria-label$="out of 10"]')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rows(page)).toHaveCount(8);
    await expect(pins(page)).toHaveCount(8);
    await expect(page).toHaveURL(/\/reviews\/food$/);
  });

  test("clicking a row selects its pin and shows the place card; clicking a pin selects its row", async ({ page }) => {
    await open(page);
    await rows(page).filter({ hasText: "La Taqueria" }).getByRole("button").click();
    const pin = page.getByRole("button", { name: "La Taqueria, 9 out of 10" });
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await expect(pin.getByText("La Taqueria")).toBeVisible();
    await expect(pins(page).and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);

    const card = page.getByRole("article", { name: "La Taqueria" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Mexican · $ · Mission, San Francisco");
    await expect(card).toContainText("Mar 14, 2026");
    await expect(card.getByRole("img", { name: "9 out of 10" })).toBeVisible();
    await expect(card.getByRole("heading", { name: "What I ordered" })).toBeVisible();
    await expect(card.getByRole("listitem").filter({ hasText: /must order/i })).toContainText("Carnitas super burrito");
    // No post is linked to this place.
    await expect(card.getByRole("link", { name: /Read the full review/ })).toHaveCount(0);

    // Tartine is a few blocks away, so its pin is in view at the zoom the selection moved to.
    await page.getByRole("button", { name: "Tartine Bakery, 8 out of 10" }).click();
    await expect(page.getByRole("article", { name: "Tartine Bakery" })).toBeVisible();
    await expect(rows(page).filter({ hasText: "Tartine Bakery" }).getByRole("button")).toHaveAttribute("aria-pressed", "true");
    await expect(pin).toHaveAttribute("aria-pressed", "false");

    // Comal has no must-order dish: the card just lists what was ordered.
    await rows(page).filter({ hasText: "Comal" }).getByRole("button").click();
    await expect(page.getByRole("button", { name: "Comal, 6 out of 10" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("article", { name: "Comal" })).toContainText("Wood-grilled rock cod tacos");
    await expect(page.getByRole("article", { name: "Comal" }).getByText(/must order/i)).toHaveCount(0);

    // A selected place that a filter hides is deselected.
    await filters(page).getByRole("group", { name: "Rating" }).getByRole("button", { name: "9–10" }).click();
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("dark mode swaps to the dark map style", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = page.waitForRequest((r) => r.url().endsWith("/map/style-dark.json"));
    await open(page);
    await dark;
    const light = page.waitForRequest((r) => r.url().endsWith("/map/style-light.json"));
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await light;
    await expect(pins(page)).toHaveCount(8);
  });
});

test("with the map tiles blocked, the list and filters still work", async ({ page }) => {
  let blocked = 0;
  await page.route(TILES, (route) => {
    blocked += 1;
    return route.abort();
  });
  await open(page);
  await expect.poll(() => blocked).toBeGreaterThan(0);
  await expect(rows(page)).toHaveCount(8);
  await chooseCuisines(page, ["Mexican", "Pizza"]);
  await expect(rows(page)).toHaveCount(4);
  await filters(page).getByRole("group", { name: "Region" }).getByRole("button", { name: "East Bay" }).click();
  await expect(rows(page)).toHaveCount(3);
  await rows(page).filter({ hasText: "Comal" }).getByRole("button").click();
  await expect(page.getByRole("article", { name: "Comal" })).toBeVisible();
});

test("an empty database shows a friendly empty page, no map", async ({ page }) => {
  await page.goto(`${EMPTY_URL}/reviews/food`);
  await expect(page.getByRole("heading", { level: 1, name: "Food" })).toBeVisible();
  await expect(page.getByText("No places yet.")).toBeVisible();
  await expect(page.getByTestId("map-placeholder")).toHaveCount(0);
  await expect(page.getByTestId("food-map")).toHaveCount(0);
});

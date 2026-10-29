import type { Locator, Page } from "@playwright/test";

/**
 * /reviews/food mounts MapLibre only once the map's box nears the viewport
 * (FoodExplorer's useNearViewport); on a phone it starts below the fold.
 * Scrolls it into view and returns the map's locator.
 */
export async function showFoodMap(page: Page): Promise<Locator> {
  await page.getByTestId("food-map-slot").scrollIntoViewIfNeeded();
  return page.getByTestId("food-map");
}

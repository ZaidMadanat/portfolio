import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { showFoodMap } from "./support/food";
import { EMPTY_URL } from "./support/servers";

// Task 33: axe on every public page (and the admin sign-in page), in light and
// dark, at 1280 and 375 px. Any `serious` or `critical` violation fails.
// Runs in its own `a11y` project (playwright.config.ts), which sets the sizes
// itself. All of axe's default rules run; none are disabled.
//
// Reduced motion is on so a scan never lands mid-animation (pins drop in with
// an opacity fade); the resting state is the same either way.

type Route = { name: string; url: string; ready?: (page: Page) => Promise<void> };

const ROUTES: Route[] = [
  { name: "home", url: "/" },
  { name: "blog", url: "/blog" },
  { name: "post with a rating box", url: "/blog/ben-hur-sixty-seven-years-later" },
  { name: "post with math", url: "/blog/median-vs-mean-for-ratings" },
  { name: "reviews", url: "/reviews" },
  {
    name: "food",
    url: "/reviews/food",
    // Scan the loaded map (pins and controls), not the placeholder.
    ready: async (page) => {
      const map = await showFoodMap(page);
      await expect(map.getByRole("button", { name: /out of 10$/ }).first()).toBeVisible();
    },
  },
  { name: "film", url: "/reviews/film" },
  { name: "music", url: "/reviews/music" },
  { name: "contact", url: "/contact" },
  { name: "subscribed", url: "/subscribed" },
  { name: "404", url: "/no-such-page" },
  { name: "admin sign-in", url: "/admin/sign-in" },
  // Empty states (no rows in the database).
  { name: "home, empty", url: `${EMPTY_URL}/` },
  { name: "blog, empty", url: `${EMPTY_URL}/blog` },
  { name: "reviews, empty", url: `${EMPTY_URL}/reviews` },
  { name: "food, empty", url: `${EMPTY_URL}/reviews/food` },
  { name: "film, empty", url: `${EMPTY_URL}/reviews/film` },
  { name: "music, empty", url: `${EMPTY_URL}/reviews/music` },
];

const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];

const SCHEMES = ["light", "dark"] as const;

for (const scheme of SCHEMES) {
  for (const size of SIZES) {
    test.describe(`${scheme} ${size.width}px`, () => {
      for (const route of ROUTES) {
        test(`${route.name} has no serious or critical axe violations`, async ({ page }) => {
          // Map tiles come from the network; the scan is about our markup.
          await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
          await page.setViewportSize(size);
          await page.goto(route.url);
          // next-themes follows the system scheme on a first visit.
          if (scheme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
          else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
          await expect(page.locator("h1").first()).toBeVisible();
          await route.ready?.(page);

          const { violations } = await new AxeBuilder({ page }).analyze();
          const blocking = violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => ({
              rule: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split("\n").slice(1).join(" ")}`),
            }));
          expect(blocking).toEqual([]);
        });
      }
    });
  }
}

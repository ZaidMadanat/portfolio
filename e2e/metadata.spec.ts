import { expect, test } from "@playwright/test";

// Every public page gets a real title, the ZM icons and the shared Open Graph
// card (src/app/layout.tsx, src/lib/site-metadata.ts).

const PAGES = [
  { path: "/", title: "Zaid Madanat" },
  { path: "/blog", title: "Blog · Zaid Madanat" },
  { path: "/blog/ben-hur-sixty-seven-years-later", title: "Ben-Hur, sixty-seven years later · Zaid Madanat" },
  { path: "/reviews", title: "Reviews · Zaid Madanat" },
  { path: "/reviews/food", title: "Food · Zaid Madanat" },
  { path: "/reviews/film", title: "Film · Zaid Madanat" },
  { path: "/reviews/music", title: "Music · Zaid Madanat" },
  { path: "/contact", title: "Contact · Zaid Madanat" },
  { path: "/subscribed", title: "Email updates · Zaid Madanat" },
  { path: "/no-such-page", title: "Page not found · Zaid Madanat" },
  { path: "/admin/sign-in", title: "Admin sign-in · Zaid Madanat" },
];

test.describe("page metadata", () => {
  test.skip(({ isMobile }) => isMobile, "same HTML at every width");

  for (const { path, title } of PAGES) {
    test(`${path} has its title, icons and Open Graph card`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      const head = page.locator("head");
      await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", /\/icon\.svg/);
      await expect(head.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
      await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
      await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        /^https?:\/\/[^/]+\/images\/zaid\.jpg$/,
      );
      await expect(head.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Zaid Madanat");
      await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    });
  }

  test("the home description is the bio", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^A student at UC Berkeley studying Statistics, with a minor in Computer Science & Philosophy\./,
    );
  });

  test("the icons are served", async ({ request }) => {
    for (const [path, type] of [
      ["/icon.svg", "image/svg+xml"],
      ["/apple-icon.png", "image/png"],
      ["/favicon.ico", "image/x-icon"],
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toContain(type);
    }
  });
});

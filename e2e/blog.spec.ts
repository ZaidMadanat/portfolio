import { expect, test, type Page } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

const filters = (page: Page) => page.getByRole("search", { name: "Filter posts" });
const cards = (page: Page) => page.getByRole("list", { name: "Posts" }).getByRole("listitem");

test.describe("blog index, seeded database", () => {
  test("title, every published post, newest first, and no subtitle", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveTitle("Blog · Zaid Madanat");
    await expect(page.getByRole("heading", { level: 1, name: "The blog" })).toBeVisible();
    await expect(cards(page)).toHaveCount(8);
    await expect(cards(page).first()).toContainText("Rebuilding zaidmadanat.com");
    await expect(cards(page).last()).toContainText("Notes on spaced repetition");
    await expect(page.getByText("8 posts", { exact: true })).toBeVisible();
  });

  test("a post card has its pill, date, reading time, excerpt, tags and a rating stamp when linked", async ({
    page,
  }) => {
    await page.goto("/blog");
    const benHur = cards(page).filter({ hasText: "Ben-Hur, sixty-seven years later" });
    await expect(benHur.getByRole("link")).toHaveAttribute("href", "/blog/ben-hur-sixty-seven-years-later");
    await expect(benHur).toContainText("Film");
    await expect(benHur).toContainText(/Apr 27, 2026 · \d+ min read/);
    await expect(benHur).toContainText("The chariot race still holds up, and so does the rest.");
    await expect(benHur).toContainText("Tags: epics, letterboxd");
    await expect(benHur.getByRole("img", { name: "10 out of 10" })).toBeVisible();

    const unrated = cards(page).filter({ hasText: "Notes on spaced repetition" });
    await expect(unrated.getByRole("img", { name: /out of 10/ })).toHaveCount(0);
  });

  test("tags render as plain text with no # anywhere", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByText("Tags: bay area, burritos")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain("#");
    // The dropdown lists every tag of a published post, after "All tags".
    const options = await filters(page).getByLabel("Tags").locator("option").allInnerTexts();
    expect(options[0]).toBe("All tags");
    expect(options).toContain("statistics");
    expect(options.join(" ")).not.toContain("#");
  });

  test("category chip + tag dropdown write the URL, and a reload keeps them", async ({ page }) => {
    await page.goto("/blog");
    await filters(page).getByRole("button", { name: "Statistics", exact: true }).click();
    await expect(page).toHaveURL(/\/blog\?cat=Statistics$/);
    await filters(page).getByLabel("Tags").selectOption("statistics");
    await expect(page).toHaveURL(/\/blog\?cat=Statistics&tag=statistics$/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Why the median beats the mean for food ratings");

    await page.reload();
    await expect(filters(page).getByRole("button", { name: "Statistics", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(filters(page).getByLabel("Tags")).toHaveValue("statistics");
    await expect(cards(page)).toHaveCount(1);
  });

  test("search, year and reading time combine", async ({ page }) => {
    await page.goto("/blog?year=2026&time=short");
    await expect(filters(page).getByLabel("Year")).toHaveValue("2026");
    await expect(filters(page).getByRole("button", { name: "Under 5 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await filters(page).getByLabel("Search").fill("BURRITO");
    await expect(page).toHaveURL(/q=BURRITO/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("A burrito crawl through the Mission");
  });

  test("a combination with no posts shows the empty state, and Clear filters resets the URL", async ({
    page,
  }) => {
    await page.goto("/blog?cat=Food&tag=statistics");
    await expect(page.getByText("Nothing matches those filters.")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(cards(page)).toHaveCount(8);
    await expect(filters(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(filters(page).getByLabel("Tags")).toHaveValue("");
  });

  test("the subscribe banner is the last section before the footer", async ({ page }) => {
    await page.goto("/blog");
    const last = page.locator("main section").last();
    await expect(last.getByRole("heading", { name: "Get new posts by email" })).toBeVisible();
    await expect(last.getByLabel("Email address")).toBeVisible();
    await expect(last.getByRole("button", { name: "Subscribe" })).toBeVisible();
    await expect(last.getByRole("link", { name: "Or follow the RSS feed" })).toHaveAttribute("href", "/rss.xml");
  });

  test("subscribing from the banner shows the check-your-inbox state (dev mailer)", async ({ page }, testInfo) => {
    await page.goto("/blog");
    const banner = page.locator("main section").last();
    await banner.getByLabel("Email address").fill(`reader-${testInfo.project.name}-${Date.now()}@example.com`);
    await banner.getByRole("button", { name: "Subscribe" }).click();
    await expect(banner.getByRole("status")).toHaveText("Almost there. Check your inbox for a confirmation link.");
  });

  test("the banner says so when the address is already subscribed", async ({ page }) => {
    await page.route("**/api/subscribe", (route) => route.fulfill({ status: 200, json: { status: "already" } }));
    await page.goto("/blog");
    const banner = page.locator("main section").last();
    await banner.getByLabel("Email address").fill("reader@example.com");
    await banner.getByRole("button", { name: "Subscribe" }).click();
    await expect(banner.getByRole("status")).toHaveText(/already subscribed/);
  });

  test("without JS the form post redirects to /subscribed", async ({ request }, testInfo) => {
    const res = await request.post("/api/subscribe", {
      form: { email: `nojs-${testInfo.project.name}-${Date.now()}@example.com` },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(new URL(res.headers().location).pathname + new URL(res.headers().location).search).toBe(
      "/subscribed?state=pending",
    );
  });

  test("/subscribed shows the state from the query", async ({ page }) => {
    await page.goto("/subscribed?state=unsubscribed");
    await expect(page.getByRole("heading", { level: 1, name: "You're unsubscribed." })).toBeVisible();
    await page.goto("/subscribed?state=bogus");
    await expect(page.getByRole("heading", { level: 1, name: "Email updates" })).toBeVisible();
  });

  test("the RSS link serves the feed with every published post", async ({ page, request }) => {
    await page.goto("/blog");
    await expect(page.locator('head link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
      "href",
      /\/rss\.xml$/,
    );
    const res = await request.get("/rss.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/rss+xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toMatch(/<channel>\s*<title>Zaid Madanat<\/title>/);
    expect(xml.match(/<item>/g)).toHaveLength(8);
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/blog");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("blog index, empty database", () => {
  test("no posts shows an empty state, and the subscribe banner stays", async ({ page }) => {
    await page.goto(`${EMPTY_URL}/blog`);
    await expect(page.getByRole("heading", { level: 1, name: "The blog" })).toBeVisible();
    await expect(page.getByText("No posts yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Get new posts by email" })).toBeVisible();
  });
});

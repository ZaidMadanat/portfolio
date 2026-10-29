import { expect, test } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

const BEN_HUR = "/blog/ben-hur-sixty-seven-years-later";
const MATH_POST = "/blog/median-vs-mean-for-ratings";
const KATEX_CSS = 'link[rel="stylesheet"][href^="/katex/"]';

test.describe("post page, seeded database", () => {
  test("header: back link, category, date, reading time, then the title", async ({ page }) => {
    await page.goto(BEN_HUR);
    await expect(page).toHaveTitle("Ben-Hur, sixty-seven years later · Zaid Madanat");
    await expect(page.getByRole("link", { name: "← All posts" })).toHaveAttribute("href", "/blog");
    const article = page.getByRole("article");
    await expect(article.getByText("Film", { exact: true }).first()).toBeVisible();
    await expect(article).toContainText(/Apr 27, 2026 · \d+ min read/);
    await expect(page.getByRole("heading", { level: 1, name: "Ben-Hur, sixty-seven years later" })).toBeVisible();
    // The view count is fetched in the browser after load (spec §3.1).
    await expect(page.getByTestId("post-meta")).toContainText(/\d+ views?/);
  });

  test("a post linked to a review shows the rating box", async ({ page }) => {
    await page.goto(BEN_HUR);
    const box = page.getByRole("complementary", { name: "Rating" });
    await expect(box).toBeVisible();
    await expect(box).toContainText("Film review");
    await expect(box).toContainText("Ben-Hur (1959)");
    await expect(box).toContainText("Watched Apr 26, 2026");
    const stamp = box.getByRole("img", { name: "10 out of 10" });
    await expect(stamp).toContainText("10");
    await expect(stamp).toContainText("out of 10");
    await expect(box.getByRole("link", { name: /See it in my film log/ })).toHaveAttribute("href", "/reviews/film");
  });

  test("a post with no review has no rating box", async ({ page }) => {
    await page.goto(MATH_POST);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Rating" })).toHaveCount(0);
  });

  test("the body renders the stored HTML: headings, math, code, callouts", async ({ page }) => {
    await page.goto(MATH_POST);
    const prose = page.locator(".prose");
    await expect(prose.getByRole("heading", { level: 2, name: "The setup" })).toBeVisible();
    await expect(prose.locator(".katex").first()).toBeVisible();

    await page.goto("/blog/render-on-save");
    await expect(page.locator(".prose pre code")).toContainText("renderPostHtml");
    await expect(page.locator(".prose aside.callout-warning")).toBeVisible();
  });

  test("KaTeX CSS loads only on posts that contain math", async ({ page, request }) => {
    await page.goto(MATH_POST);
    await expect(page.locator(KATEX_CSS)).toHaveCount(1);
    // The stylesheet is applied: KaTeX hides its MathML copy visually.
    await expect(page.locator(".prose .katex-mathml").first()).toHaveCSS("position", "absolute");
    const href = await page.locator(KATEX_CSS).getAttribute("href");
    expect((await request.get(href!)).status()).toBe(200);

    await page.goto(BEN_HUR);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(KATEX_CSS)).toHaveCount(0);
  });

  test("tags are plain text, and there's no comments section anywhere", async ({ page }) => {
    await page.goto(BEN_HUR);
    await expect(page.getByText("Tags: epics, letterboxd", { exact: true })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain("#");
    await expect(page.locator("text=/comment/i")).toHaveCount(0);
  });

  test("like is add-only: Liked and disabled, still Liked after a reload", async ({ page }) => {
    await page.goto(BEN_HUR);
    const like = page.getByRole("button", { name: "Like", exact: true });
    await expect(like).toBeEnabled();
    await expect(page.getByTestId("like-count")).toContainText(/\d+ likes?/);
    await like.click();
    const liked = page.getByRole("button", { name: "Liked", exact: true });
    await expect(liked).toBeDisabled();
    await expect(page.getByRole("button", { name: "Like", exact: true })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "Liked", exact: true })).toBeDisabled();
  });

  test("a view is recorded once per session", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/views/") && r.method() === "POST") posts.push(r.url());
    });
    await page.goto("/blog/albums-on-repeat");
    await expect(page.getByTestId("post-meta")).toContainText(/\d+ views?/);
    await page.reload();
    await expect(page.getByTestId("post-meta")).toContainText(/\d+ views?/);
    expect(posts).toHaveLength(1);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("viewed:")))).toHaveLength(1);
  });

  test("Copy link puts the post URL on the clipboard", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(BEN_HUR);
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}${BEN_HUR}`);
  });

  test("subscribe box, then Keep reading with two other posts", async ({ page }) => {
    await page.goto(BEN_HUR);
    await expect(page.getByRole("heading", { name: "Liked this? Get the next one by email." })).toBeVisible();
    const more = page.getByRole("region", { name: "Keep reading" });
    const links = more.getByRole("link");
    await expect(links).toHaveCount(2);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      expect(href).toMatch(/^\/blog\/.+/);
      expect(href).not.toBe(BEN_HUR);
    }
  });

  test("an old slug 308-redirects to the current one", async ({ page, request }) => {
    const res = await request.get("/blog/ben-hur-at-sixty-seven", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe(BEN_HUR);
    await page.goto("/blog/ben-hur-at-sixty-seven");
    await expect(page).toHaveURL(BEN_HUR);
    await expect(page.getByRole("heading", { level: 1, name: "Ben-Hur, sixty-seven years later" })).toBeVisible();
  });

  test("an unknown slug is a 404", async ({ page }) => {
    const res = await page.goto("/blog/no-such-post");
    expect(res?.status()).toBe(404);
  });

  test("no horizontal scroll", async ({ page }) => {
    for (const path of [BEN_HUR, MATH_POST, "/blog/render-on-save"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("post page, empty database", () => {
  test("any slug is a 404", async ({ page }) => {
    const res = await page.goto(`${EMPTY_URL}/blog/ben-hur-sixty-seven-years-later`);
    expect(res?.status()).toBe(404);
  });
});

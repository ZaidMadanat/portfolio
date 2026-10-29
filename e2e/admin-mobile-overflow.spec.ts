import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";
import { e2eId, sql } from "./support/db";

// No page scrolls sideways on a phone (spec: everything works at 375 px).
// Wide content such as the subscribers table must scroll inside its own box.
// Watch for `sr-only` text inside a scroll box: it is position:absolute, so
// without a positioned ancestor it escapes the box and widens the whole page.
// Runs in the mobile project only (375 px, isMobile), where a wide document
// also widens the layout viewport and makes taps miss.

const WIDTH = 375;
const SEEDED_SLUG = "rebuilding-zaidmadanat-com"; // a seeded published post

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
});

async function expectNoSideScroll(page: Page, path: string, ready: (page: Page) => Locator) {
  await page.goto(path);
  await expect(ready(page)).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${path} is ${scrollWidth}px wide`).toBeLessThanOrEqual(WIDTH);
}

const h1 = (name?: string | RegExp) => (page: Page) => page.getByRole("heading", { level: 1, name });

test.describe("admin pages", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("dashboard, posts, templates, media and favourites", async ({ page }) => {
    await expectNoSideScroll(page, "/admin", h1(/, Zaid\.$/));
    await expectNoSideScroll(page, "/admin/posts", h1("Posts"));
    await expectNoSideScroll(page, "/admin/templates", h1("Templates"));
    await expectNoSideScroll(page, "/admin/media", h1("Photo library"));
    await expectNoSideScroll(page, "/admin/favourites", h1("Favourites"));
  });

  test("the editor for a seeded post", async ({ page }) => {
    const [post] = await sql<{ id: string }>(`SELECT id FROM "Post" WHERE slug = $1`, [SEEDED_SLUG]);
    expect(post, `seeded post ${SEEDED_SLUG}`).toBeDefined();
    await expectNoSideScroll(page, `/admin/posts/${post.id}`, (p) => p.locator(".bn-editor"));
  });

  test("reviews: the list, the new form on every tab, and a seeded review", async ({ page }) => {
    await expectNoSideScroll(page, "/admin/reviews", h1("Reviews"));
    for (const kind of ["FOOD", "FILM", "ALBUM", "CONCERT"]) {
      await expectNoSideScroll(page, `/admin/reviews/new?kind=${kind}`, h1("New review"));
    }
    await expectNoSideScroll(page, "/admin/reviews/dev-fixture-food-burma-superstar", h1("Edit review"));
  });

  test("subscribers, with rows in the table", async ({ page }) => {
    const id = e2eId();
    const email = `e2e-overflow-${id}@example.com`;
    await sql(
      `INSERT INTO "Subscriber" (id, email, status, "confirmToken", "unsubscribeToken") VALUES ($1, $2, 'CONFIRMED', $3, $4)`,
      [id, email, e2eId(), e2eId()],
    );
    try {
      await expectNoSideScroll(page, "/admin/subscribers", (p) => p.getByRole("row").filter({ hasText: email }));
    } finally {
      await sql(`DELETE FROM "Subscriber" WHERE id = $1`, [id]);
    }
  });
});

test.describe("public pages", () => {
  const ROUTES: [string, (page: Page) => Locator][] = [
    ["/", h1()],
    ["/blog", h1()],
    [`/blog/${SEEDED_SLUG}`, h1()],
    ["/reviews", h1()],
    ["/contact", h1()],
    ["/subscribed?state=pending", h1()],
    ["/no-such-page", h1()],
  ];

  for (const [path, ready] of ROUTES) {
    test(`${path} fits 375 px`, async ({ page }) => {
      await expectNoSideScroll(page, path, ready);
    });
  }
});

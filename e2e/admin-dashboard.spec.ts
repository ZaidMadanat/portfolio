import { expect, test } from "@playwright/test";
import { signInAsAdmin, signInAsAdminOnEmpty } from "./support/admin";
import { e2eId, sql } from "./support/db";
import { E2E_CRON_SECRET, EMPTY_URL } from "./support/servers";

// The admin dashboard (spec §7): greeting, quick-create links, stat tiles,
// drafts with Continue, and sync status with "Run sync now" (a server action;
// the cron secret never reaches the browser). Also the Reviews hub's "Pick
// your top 4" prompt, shown only to the signed-in admin on a static page.

const GREETING = /^(Morning|Afternoon|Evening), Zaid\.$/;

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("greets Zaid and links every quick-create button", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(GREETING);
    const create = page.getByRole("navigation", { name: "Create" });
    const links = [
      ["+ New post", "/admin/posts/new"],
      ["+ Food", "/admin/reviews/new?kind=FOOD"],
      ["+ Film", "/admin/reviews/new?kind=FILM"],
      ["+ Album", "/admin/reviews/new?kind=ALBUM"],
      ["+ Concert", "/admin/reviews/new?kind=CONCERT"],
    ];
    await expect(create.getByRole("link")).toHaveText(links.map(([name]) => name));
    for (const [name, href] of links) {
      await expect(create.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
  });

  test("shows the stat tiles", async ({ page }) => {
    await page.goto("/admin");
    const tiles = page.getByRole("list", { name: "Stats" }).getByRole("listitem");
    await expect(tiles).toHaveCount(5);
    const tile = (label: string) => tiles.filter({ hasText: new RegExp(`^${label}`) });
    for (const label of ["Published posts", "Drafts", "Reviews", "Confirmed subscribers", "Views"]) {
      await expect(tile(label)).toHaveCount(1);
    }
    // The seeded site: 8 published posts and 15 reviews (8 food, 1 film, 4 albums, 2 concerts).
    await expect(tile("Published posts").getByTestId("stat-value")).toHaveText("8");
    await expect(tile("Reviews").getByTestId("stat-value")).toHaveText("15");
    await expect(tile("Reviews")).toContainText("8 food · 1 film · 4 albums · 2 concerts");
  });

  test("lists a draft with Continue", async ({ page }, info) => {
    const id = e2eId();
    const title = `E2E dashboard draft ${info.project.name} ${Date.now()}`;
    await sql(
      `INSERT INTO "Post" (id, slug, title, blocks, category, "updatedAt") VALUES ($1, $1, $2, '[]', 'NOTES', now() + interval '1 hour')`,
      [id, title],
    );
    try {
      await page.goto("/admin");
      const drafts = page.getByRole("region", { name: "Drafts" });
      const row = drafts.getByRole("listitem").filter({ hasText: title });
      await expect(row.getByRole("link", { name: `Continue ${title}` })).toHaveAttribute("href", `/admin/posts/${id}`);
    } finally {
      await sql(`DELETE FROM "Post" WHERE id = $1`, [id]);
    }
  });

  test("each source shows its last run and a Run sync now button", async ({ page }) => {
    const id = e2eId();
    await sql(
      `INSERT INTO "SyncRun" (id, source, "startedAt", "finishedAt", ok, message, "itemsChanged") VALUES ($1, 'LETTERBOXD', now() + interval '1 day', now() + interval '1 day', true, '', 3)`,
      [id],
    );
    try {
      await page.goto("/admin");
      const sync = page.getByRole("list", { name: "Sync status" }).getByRole("listitem");
      await expect(sync).toHaveCount(3);
      for (const name of ["Letterboxd", "stats.fm", "Strava"]) {
        await expect(sync.filter({ hasText: name }).getByRole("button", { name: `Run sync now for ${name}` })).toBeVisible();
      }
      await expect(sync.filter({ hasText: "Letterboxd" })).toContainText("3 changed");

      // Locally the Strava guard refuses before any request (never the real API);
      // the failed run is logged and the row shows it after the refresh.
      await page.getByRole("button", { name: "Run sync now for Strava" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Strava:" })).toHaveText(
        "Strava: Strava sync calls the real API only on Vercel. Set STRAVA_ALLOW_LOCAL=1 to run it from this machine.",
      );
      await expect(sync.filter({ hasText: "Strava" })).toContainText("Failed");
      await expect(sync.filter({ hasText: "Strava" })).toContainText("failed: Strava sync calls the real API only on Vercel");
    } finally {
      await sql(`DELETE FROM "SyncRun" WHERE id = $1 OR (source = 'STRAVA' AND ok = false)`, [id]);
    }
  });

  test("the page never contains the cron secret", async ({ page }) => {
    const res = await page.request.get("/admin");
    expect(res.ok()).toBe(true);
    expect(await res.text()).not.toContain(E2E_CRON_SECRET);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(GREETING);
    expect(await page.content()).not.toContain(E2E_CRON_SECRET);
  });
});

test.describe("reviews hub top-4 prompt", () => {
  test("shows the signed-in admin where to pick the top 4", async ({ page }) => {
    await signInAsAdminOnEmpty(page);
    await page.goto(`${EMPTY_URL}/reviews`);
    for (const kind of ["films", "albums"]) {
      await expect(page.getByText(`No top 4 ${kind} yet.`)).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Pick your top 4 in the admin/ })).toHaveCount(2);
    await expect(page.getByRole("link", { name: /Pick your top 4 in the admin/ }).first()).toHaveAttribute(
      "href",
      "/admin/favourites",
    );
  });

  test("visitors never see it", async ({ page }) => {
    const session = page.waitForResponse((r) => r.url().endsWith("/api/admin/session"));
    await page.goto(`${EMPTY_URL}/reviews`);
    expect(await (await session).json()).toEqual({ admin: false });
    await expect(page.getByText(/Pick your top 4/)).toHaveCount(0);
  });
});

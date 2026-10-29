import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";
import { e2eId, sql } from "./support/db";

// The posts list, templates and subscribers admin pages (spec §7). Drafts and
// subscribers never reach a public page, so these specs run alongside the
// others; each one creates its own rows and deletes them at the end.

const PUBLISHED_TITLE = "Notes on spaced repetition"; // a seeded published post

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.describe("posts list", () => {
  test("+ New post with the Notes / cheat sheet template opens the editor pre-filled", async ({ page }) => {
    await page.goto("/admin/posts");
    await expect(page.getByRole("heading", { level: 1, name: "Posts" })).toBeVisible();
    await page.getByLabel("Template").selectOption({ label: "Notes / cheat sheet" });
    await page.getByRole("button", { name: "+ New post" }).click();
    await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
    await expect(page.locator(".bn-editor").getByRole("heading", { name: "Summary" })).toBeVisible();
    await sql(`DELETE FROM "Post" WHERE id = $1`, [page.url().split("/").pop()]);
  });

  test("filters drafts and published posts", async ({ page }, info) => {
    const id = e2eId();
    const title = `E2E draft ${info.project.name} ${Date.now()}`;
    await sql(
      `INSERT INTO "Post" (id, slug, title, blocks, category, "updatedAt") VALUES ($1, $1, $2, '[]', 'NOTES', now())`,
      [id, title],
    );
    try {
      await page.goto("/admin/posts");
      const list = page.getByRole("list", { name: "Posts" });
      await expect(list.getByRole("link", { name: title, exact: true })).toBeVisible();
      await expect(list.getByRole("link", { name: PUBLISHED_TITLE, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /^All/ })).toHaveAttribute("aria-current", "page");

      await page.getByRole("link", { name: /^Drafts/ }).click();
      await expect(page).toHaveURL(/\/admin\/posts\?status=draft$/);
      await expect(page.getByRole("link", { name: /^Drafts/ })).toHaveAttribute("aria-current", "page");
      await expect(list.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/admin/posts/${id}`);
      await expect(list.getByRole("link", { name: PUBLISHED_TITLE, exact: true })).toHaveCount(0);
      await expect(list.getByTestId("post-row-status").filter({ hasNotText: "Draft" })).toHaveCount(0);

      await page.getByRole("link", { name: /^Published/ }).click();
      await expect(page).toHaveURL(/\/admin\/posts\?status=published$/);
      await expect(list.getByRole("link", { name: PUBLISHED_TITLE, exact: true })).toBeVisible();
      await expect(list.getByRole("link", { name: title, exact: true })).toHaveCount(0);
      await expect(list.getByTestId("post-row-status").filter({ hasNotText: "Published" })).toHaveCount(0);
    } finally {
      await sql(`DELETE FROM "Post" WHERE id = $1`, [id]);
    }
  });
});

test.describe("templates", () => {
  test("lists the built-ins, each starting a new post", async ({ page }) => {
    await page.goto("/admin/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    const builtIns = page.getByRole("list", { name: "Built-in templates" });
    await expect(builtIns.getByRole("heading", { level: 3 })).toHaveText([
      "Essay",
      "Notes / cheat sheet",
      "Project write-up",
      "Restaurant review",
      "Film review",
      "Album review",
      "Concert review",
    ]);
    await expect(builtIns.getByRole("link", { name: "New post from Notes / cheat sheet" })).toHaveAttribute(
      "href",
      "/admin/posts/new?template=builtin-notes",
    );
    // Built-ins can't be deleted.
    await expect(builtIns.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  });

  test("deletes a saved template", async ({ page }, info) => {
    const id = e2eId();
    const name = `E2E template ${info.project.name} ${Date.now()}`;
    await sql(`INSERT INTO "Template" (id, name, blocks, "updatedAt") VALUES ($1, $2, '[]', now())`, [id, name]);
    try {
      await page.goto("/admin/templates");
      const mine = page.getByRole("list", { name: "Your templates" });
      await expect(mine.getByRole("heading", { name })).toBeVisible();
      await mine.getByRole("button", { name: `Delete ${name}` }).click();
      await mine.getByRole("button", { name: "Yes, delete it" }).click();
      await expect(mine.getByRole("heading", { name })).toHaveCount(0);
      expect(await sql(`SELECT id FROM "Template" WHERE id = $1`, [id])).toHaveLength(0);
    } finally {
      await sql(`DELETE FROM "Template" WHERE id = $1`, [id]);
    }
  });
});

test.describe("subscribers", () => {
  const STATUSES = ["PENDING", "CONFIRMED", "UNSUBSCRIBED"] as const;

  test("lists subscribers with their status, exports CSV and removes one", async ({ page }, info) => {
    const stamp = `${info.project.name}-${e2eId()}`;
    const rows = STATUSES.map((status) => ({ id: e2eId(), email: `e2e-${status.toLowerCase()}-${stamp}@example.com`, status }));
    for (const r of rows) {
      await sql(
        `INSERT INTO "Subscriber" (id, email, status, "confirmToken", "unsubscribeToken") VALUES ($1, $2, $3, $4, $5)`,
        [r.id, r.email, r.status, e2eId(), e2eId()],
      );
    }
    try {
      await page.goto("/admin/subscribers");
      await expect(page.getByRole("heading", { level: 1, name: "Subscribers" })).toBeVisible();
      for (const r of rows) {
        const row = page.getByRole("row").filter({ hasText: r.email });
        await expect(row.getByRole("cell", { name: r.status, exact: true })).toBeVisible();
      }

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Export CSV" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^subscribers-\d{4}-\d{2}-\d{2}\.csv$/);
      const lines = readFileSync((await download.path())!, "utf8").trim().split("\r\n");
      expect(lines[0]).toBe("email,status,createdAt");
      for (const r of rows) {
        expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^${r.email.replaceAll(".", "\\.")},${r.status},\\d{4}-\\d{2}-\\d{2}T`)));
      }

      const gone = rows[0];
      const row = page.getByRole("row").filter({ hasText: gone.email });
      await row.getByRole("button", { name: `Remove ${gone.email}` }).click();
      await row.getByRole("button", { name: "Yes, remove" }).click();
      await expect(page.getByRole("row").filter({ hasText: gone.email })).toHaveCount(0);
      expect(await sql(`SELECT id FROM "Subscriber" WHERE id = $1`, [gone.id])).toHaveLength(0);
    } finally {
      await sql(`DELETE FROM "Subscriber" WHERE id = ANY($1)`, [rows.map((r) => r.id)]);
    }
  });

  test("the CSV export needs an admin session", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.get("/admin/subscribers/export", { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
    expect(await res.text()).not.toContain("email,status,createdAt");
    await anon.dispose();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";

// The post editor end to end (spec §7, §7.3): a draft from the "Notes / cheat
// sheet" template, a paragraph and a math block, autosave, publish, and the
// post on the public site on the very next load. /blog is prerendered at build
// time, so seeing the new post there proves the publish expired its tags
// (updateTag). Runs in the "writes" project, after every other spec, and
// unpublishes at the end.

test("write a post from a template, publish it and read it publicly", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/posts/new?template=builtin-notes");
  await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
  const editorUrl = page.url();

  const editor = page.locator(".bn-editor");
  await expect(editor.getByRole("heading", { name: "Summary" })).toBeVisible();
  const settings = page.getByRole("complementary", { name: "Post settings" });
  await expect(settings.getByLabel("Template")).toHaveValue("builtin-notes");
  await expect(settings.getByLabel("Category")).toHaveValue("NOTES");

  const stamp = Date.now();
  const title = `E2E math post ${stamp}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await expect(settings.getByLabel("URL")).toHaveValue(`e2e-math-post-${stamp}`);

  // The empty paragraph under "Summary".
  await editor.locator('[data-content-type="paragraph"]').first().click();
  await page.keyboard.type("A paragraph written in the e2e test.");
  await page.keyboard.press("Enter");

  // The "/" menu has exactly the spec's eight blocks.
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox");
  await expect(menu.locator(".bn-mt-suggestion-menu-item-title")).toHaveText([
    "Heading",
    "Bulleted list",
    "Image",
    "Quote",
    "Code",
    "Math",
    "Callout",
    "Divider",
  ]);
  await page.keyboard.type("math");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("LaTeX")).toBeFocused();
  await page.keyboard.type("z = \\frac{x}{y}");
  await expect(editor.locator(".post-math .katex")).toBeVisible();

  await expect(page.getByTestId("save-status")).toHaveText("Saved · just now", { timeout: 10_000 });
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("post-status")).toHaveText("Published");
  await expect(page.getByRole("link", { name: "View post" })).toHaveAttribute("href", `/blog/e2e-math-post-${stamp}`);

  // The prerendered blog index shows it on the first load after publishing.
  await page.goto("/blog");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.goto(`/blog/e2e-math-post-${stamp}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const body = page.locator(".prose");
  await expect(body).toContainText("A paragraph written in the e2e test.");
  await expect(body.locator(".math .katex")).toBeVisible();
  await expect(page.locator('link[href="/katex/katex.min.css"]')).toHaveCount(1);
  // No editor CSS on public pages.
  expect(await page.evaluate(() => [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r.cssText.includes(".bn-mantine"))))).toBe(false);

  // Tidy up: unpublish, and it's gone from the index on the next load.
  await page.goto(editorUrl);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByTestId("post-status")).toHaveText("Draft");
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});

test("the editor's preview shows a draft as it will look", async ({ page, context }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/posts/new?template=builtin-essay");
  await expect(page.locator(".bn-editor").getByRole("heading", { name: "The question" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("A preview check");
  await expect(page.getByTestId("save-status")).toHaveText("Saved · just now", { timeout: 10_000 });

  const [preview] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Preview" }).click()]);
  await expect(preview.getByText("Preview of a draft. It isn't public yet.")).toBeVisible();
  await expect(preview.getByRole("heading", { level: 1, name: "A preview check" })).toBeVisible();
  await expect(preview.locator(".prose")).toContainText("The question");
});

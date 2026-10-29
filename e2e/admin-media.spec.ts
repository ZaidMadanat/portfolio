import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInAsAdmin } from "./support/admin";

// The photo library (spec §7) through the real upload pipeline: the browser
// resizes, /api/admin/media writes the sizes to public/uploads (the local
// store) and records the row. `next start` doesn't serve files added after the
// build, so these tests assert on the stored URLs, not on the images loading.

const jpeg = (seed: number) =>
  sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: seed % 256, g: 120, b: 200 } } })
    .jpeg()
    .toBuffer();

test.describe("photo library", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("upload a photo, describe it, copy its link and delete it", async ({ page, context, browserName }, info) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const name = `e2e-${info.project.name}-${Date.now()}.jpg`;

    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { level: 1, name: "Photo library" })).toBeVisible();
    await page.getByLabel(/Drop photos here to upload/).setInputFiles({
      name,
      mimeType: "image/jpeg",
      buffer: await jpeg(Date.now()),
    });

    const tile = page.getByRole("button", { name, exact: true });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    const thumb = await tile.locator("img").getAttribute("src");
    expect(thumb).toMatch(/^\/uploads\/media\/[a-z0-9]+\/480\.webp$/);
    const id = thumb!.split("/")[3];

    const details = page.getByRole("complementary", { name: "Photo details" });
    await expect(details.getByRole("heading", { name })).toBeVisible();
    await expect(details).toContainText("1200 × 800");
    await expect(details).toContainText("Not used yet");

    await details.getByLabel("Alt text").fill("A blue test card");
    await details.getByRole("button", { name: "Save alt text" }).click();
    await expect(details.getByRole("status")).toHaveText("Alt text saved.");

    await details.getByRole("button", { name: "Copy link" }).click();
    await expect(details.getByRole("status")).toHaveText("Link copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      new RegExp(`^http://localhost:3100/uploads/media/${id}/1200\\.webp$`),
    );

    // Filters: an unused photo shows under All and Unused, not In use.
    await page.getByRole("button", { name: "In use", exact: true }).click();
    await expect(tile).toHaveCount(0);
    await page.getByRole("button", { name: "Unused", exact: true }).click();
    await expect(tile).toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // The alt text was stored: it's there after a reload.
    await page.reload();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(details.getByLabel("Alt text")).toHaveValue("A blue test card");

    await details.getByRole("button", { name: "Delete", exact: true }).click();
    await details.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Photo library" })).toBeVisible();
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  });

  test("a photo it can't read gets the friendly message", async ({ page }) => {
    await page.goto("/admin/media");
    await page.getByLabel(/Drop photos here to upload/).setInputFiles({
      name: "IMG_0001.HEIC",
      mimeType: "image/heic",
      buffer: Buffer.from("not really a heic"),
    });
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Couldn't process this photo. Export it as JPEG and try again.");
  });

  test("works at 375 px with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { level: 1, name: "Photo library" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

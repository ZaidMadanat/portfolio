import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./support/admin";
import { showFoodMap } from "./support/food";

// Spec §5: touch targets are at least 44 × 44 px. axe's `target-size` rule
// only asks for 24 px, so this checks every visible interactive element on a
// phone (the mobile project, 375 × 812).
//
// What is measured is the clickable area, not the glyph:
// - the element's border box;
// - plus an absolutely positioned ::before / ::after that widens the hit area;
// - for a form control, plus its <label>s (a click on the label works too).
//
// The only exception is the WCAG 2.5.8 inline one: a text link inside a
// sentence (an inline <a> whose block also holds other text). Everything else
// must be at least 44 × 44.

const MIN = 44;
const SEEDED_SLUG = "rebuilding-zaidmadanat-com"; // a seeded published post

const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=switch]",
  "[role=tab]",
  "[role=option]",
  "[role=menuitem]",
  "[role=menuitemcheckbox]",
  "[role=menuitemradio]",
].join(",");

type Small = { target: string; width: number; height: number };

/** Every visible interactive element whose hit area is under MIN on either side. */
async function smallTargets(page: Page): Promise<Small[]> {
  return page.evaluate(
    ({ selector, min }) => {
      type Box = { left: number; top: number; right: number; bottom: number };
      const union = (a: Box, b: Box): Box => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      });
      const px = (v: string) => parseFloat(v) || 0;

      // Hidden, or visually hidden (sr-only: a clipped 1px box).
      const hidden = (el: Element) => {
        if (!el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) return true;
        if (el.closest("[inert], [aria-hidden=true]")) return true;
        for (let n: Element | null = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true;
        }
        const r = el.getBoundingClientRect();
        return r.width === 0 || r.height === 0;
      };

      // WCAG 2.5.8 inline exception: a link in a sentence.
      const inlineInText = (el: Element) => {
        if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
        let block = el.parentElement;
        while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
        const own = (el.textContent ?? "").trim();
        const all = (block?.textContent ?? "").replace(/\s+/g, " ").trim();
        return all.length > own.replace(/\s+/g, " ").length;
      };

      // An absolutely positioned pseudo-element that grows the hit area.
      const pseudoBox = (el: Element, which: "::before" | "::after", rect: DOMRect): Box | null => {
        const s = getComputedStyle(el, which);
        if (s.content === "none" || s.content === "normal" || s.position !== "absolute") return null;
        if (getComputedStyle(el).position === "static") return null;
        const host = getComputedStyle(el);
        const left = rect.left + px(host.borderLeftWidth) + px(s.left);
        const top = rect.top + px(host.borderTopWidth) + px(s.top);
        const width = px(s.width) + px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
        const height = px(s.height) + px(s.paddingTop) + px(s.paddingBottom) + px(s.borderTopWidth) + px(s.borderBottomWidth);
        return { left, top, right: left + width, bottom: top + height };
      };

      const describe = (el: Element) => {
        const name =
          el.getAttribute("aria-label") ??
          (el as HTMLInputElement).labels?.[0]?.textContent ??
          el.getAttribute("placeholder") ??
          el.textContent ??
          "";
        const id = el.id ? `#${el.id}` : "";
        const type = el.getAttribute("type") ? `[type=${el.getAttribute("type")}]` : "";
        const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 3).join(".") : "";
        return `${el.tagName.toLowerCase()}${id}${type}${cls ? `.${cls}` : ""} "${name.replace(/\s+/g, " ").trim().slice(0, 40)}"`;
      };

      const out: { target: string; width: number; height: number }[] = [];
      for (const el of document.querySelectorAll(selector)) {
        if (hidden(el) && !(el as HTMLInputElement).labels?.length) continue;
        if (inlineInText(el)) continue;
        const rect = el.getBoundingClientRect();
        let box: Box | null = hidden(el) ? null : rect;
        for (const which of ["::before", "::after"] as const) {
          const p = pseudoBox(el, which, rect);
          if (p) box = box ? union(box, p) : p;
        }
        for (const label of (el as HTMLInputElement).labels ?? []) {
          if (hidden(label)) continue;
          const r = label.getBoundingClientRect();
          box = box ? union(box, r) : r;
        }
        if (!box) continue;
        const width = Math.round((box.right - box.left) * 10) / 10;
        const height = Math.round((box.bottom - box.top) * 10) / 10;
        // Sub-pixel layout can land a 44 px box at 43.99.
        if (width < min - 0.05 || height < min - 0.05) out.push({ target: describe(el), width, height });
      }
      return out;
    },
    { selector: INTERACTIVE, min: MIN },
  );
}

async function expectBigTargets(page: Page, where: string) {
  const small = await smallTargets(page);
  expect.soft(small, `${where}: targets under ${MIN} px`).toEqual([]);
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
});

const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).first();

test.describe("public pages", () => {
  test.beforeEach(async ({ page }) => {
    // Map tiles come from the network; the pins and controls are our markup.
    await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  const ROUTES = [
    "/",
    "/reviews",
    "/contact",
    "/subscribed?state=pending",
    "/subscribed?state=confirmed",
    "/no-such-page",
    "/admin/sign-in",
  ];
  for (const path of ROUTES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(h1(page)).toBeVisible();
      await expectBigTargets(page, path);
    });
  }

  test("skip link, once focused", async ({ page }) => {
    await page.goto("/");
    await expect(h1(page)).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(MIN);
    expect(box?.height).toBeGreaterThanOrEqual(MIN);
  });

  test("/blog with its filters, and an empty result", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("search", { name: "Filter posts" })).toBeVisible();
    await expectBigTargets(page, "/blog");
    // No match: the empty state's Clear button.
    await page.getByLabel("Search").fill("zzzz no post has this");
    await expect(page.getByRole("button", { name: /clear/i })).toBeVisible();
    await expectBigTargets(page, "/blog, no results");
  });

  test("a post: like, copy link and the subscribe form", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_SLUG}`);
    await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
    await expectBigTargets(page, `/blog/${SEEDED_SLUG}`);
  });

  test("a post with a rating box and math", async ({ page }) => {
    for (const slug of ["ben-hur-sixty-seven-years-later", "median-vs-mean-for-ratings"]) {
      await page.goto(`/blog/${slug}`);
      await expect(h1(page)).toBeVisible();
      await expectBigTargets(page, `/blog/${slug}`);
    }
  });

  test("/reviews/food: filters, the open cuisine list, pins, map controls and rows", async ({ page }) => {
    await page.goto("/reviews/food");
    const map = await showFoodMap(page);
    await expect(map.getByRole("button", { name: /out of 10$/ }).first()).toBeVisible();
    await expectBigTargets(page, "/reviews/food");

    await page.getByRole("button", { name: "All cuisines" }).click();
    await expect(page.getByRole("group", { name: "Cuisines" })).toBeVisible();
    await expectBigTargets(page, "/reviews/food, cuisine list open");

    // A cuisine with places picked: its removable chip and the clear button.
    await page
      .getByRole("group", { name: "Cuisines" })
      .getByRole("checkbox", { name: /\b[1-9]\d* places?$/ })
      .first()
      .check();
    await page.getByRole("button", { name: "Done" }).click();
    await expectBigTargets(page, "/reviews/food, one cuisine picked");

    // The attribution, unfolded.
    const credit = map.locator(".maplibregl-ctrl-attrib-button");
    if (await credit.isVisible()) {
      await credit.click();
      await expectBigTargets(page, "/reviews/food, map credit open");
    }
  });

  test("/reviews/film: filters and anchor pills", async ({ page }) => {
    await page.goto("/reviews/film");
    await expect(h1(page)).toBeVisible();
    await expectBigTargets(page, "/reviews/film");
  });

  test("/reviews/music: anchor pills and lists", async ({ page }) => {
    await page.goto("/reviews/music");
    await expect(h1(page)).toBeVisible();
    await expectBigTargets(page, "/reviews/music");
  });
});

test.describe("admin, signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  const ROUTES = [
    "/admin",
    "/admin/posts",
    "/admin/templates",
    "/admin/media",
    "/admin/favourites",
    "/admin/reviews",
    "/admin/reviews/new?kind=FILM",
    "/admin/reviews/new?kind=ALBUM",
    "/admin/reviews/new?kind=CONCERT",
    "/admin/subscribers",
  ];
  for (const path of ROUTES) {
    test(`${path}: sidebar and buttons`, async ({ page }) => {
      await page.goto(path);
      await expect(h1(page)).toBeVisible();
      await expectBigTargets(page, path);
    });
  }

  test("a food review: the form and the pin picker's map controls", async ({ page }) => {
    await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    for (const path of ["/admin/reviews/new?kind=FOOD", "/admin/reviews/dev-fixture-food-burma-superstar"]) {
      await page.goto(path);
      await expect(h1(page)).toBeVisible();
      await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
      await expectBigTargets(page, path);
    }
  });
});

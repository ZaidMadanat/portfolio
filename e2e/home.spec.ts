import { expect, test, type Page } from "@playwright/test";
import { EMPTY_URL } from "./support/servers";

const SECTION_HEADINGS = [
  "Hi, I'm Zaid.",
  "Things I've built",
  "Off the keyboard",
  "Lately",
  "Got a project, a question, or a film rec?",
];

const section = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test.describe("home, seeded database", () => {
  test("sections appear in the spec order", async ({ page }) => {
    await page.goto("/");
    const headings = (await page.locator("main h1, main h2").allInnerTexts()).map((t) =>
      t.replace(/\s+/g, " ").trim(),
    );
    expect(headings).toEqual(SECTION_HEADINGS);
  });

  test("hero has the pill, bio, both buttons and the top-anchored photo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Statistics · UC Berkeley", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "A student at UC Berkeley studying Statistics, with a minor in Computer Science & Philosophy. My focus is multimodal agents, reinforcement learning, transfer learning and philosophy in AI. I'm connecting statistics and philosophy to push the boundaries of artificial intelligence.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the blog" })).toHaveAttribute("href", "/blog");
    await expect(page.getByRole("link", { name: "What I'm watching & eating" })).toHaveAttribute(
      "href",
      "/reviews",
    );
    const photo = page.locator('img[alt="Zaid Madanat"]');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveCSS("object-position", "50% 0%");
  });

  test("Ajir is featured with no link; the other three link to GitHub", async ({ page }) => {
    await page.goto("/");
    const projects = section(page, "Things I've built");
    const ajir = projects.getByRole("article", { name: "Ajir" });
    await expect(ajir).toBeVisible();
    await expect(ajir.getByText("Featured", { exact: true })).toBeVisible();
    await expect(ajir.getByText("Pre-seed · private beta", { exact: true })).toBeVisible();
    await expect(ajir.getByText(/A neighborhood rental marketplace/)).toBeVisible();
    await expect(ajir.getByRole("link")).toHaveCount(0);

    const repos = [
      ["Plateful", "https://github.com/ZaidMadanat/Plateful"],
      ["Alfworld Green & White Agent", "https://github.com/ZaidMadanat/alfworld-greenagent"],
      ["Berkeley Mobile", "https://github.com/asuc-octo/berkeley-mobile-ios"],
    ] as const;
    for (const [name, href] of repos) {
      const card = projects.getByRole("article", { name, exact: true });
      await expect(card.getByRole("link")).toHaveCount(1);
      await expect(card.getByRole("link")).toHaveAttribute("href", href);
    }
    await expect(projects.getByText("Study Buddy")).toHaveCount(0);
  });

  test("Off the keyboard shows the empty state when there are no activities", async ({ page }) => {
    await page.goto("/");
    await expect(
      section(page, "Off the keyboard").getByText("No activities in the last two weeks."),
    ).toBeVisible();
  });

  test("Lately shows the last film, the top album and the latest post", async ({ page }) => {
    await page.goto("/");
    const lately = section(page, "Lately");
    const film = lately.getByRole("link", { name: /Last watched/ });
    await expect(film).toHaveAttribute("href", "/reviews/film");
    await expect(film).toContainText("Ben-Hur (1959)");
    await expect(film.getByRole("img", { name: "10 out of 10" })).toBeVisible();

    const album = lately.getByRole("link", { name: /On repeat/ });
    await expect(album).toHaveAttribute("href", "/reviews/music");
    await expect(album).toContainText("Marty Supreme (Original Soundtrack)");
    await expect(album).toContainText("Daniel Lopatin");

    const post = lately.getByRole("link", { name: /Latest post/ });
    await expect(post).toHaveAttribute("href", "/blog/rebuilding-zaidmadanat-com");
    await expect(post).toContainText("Rebuilding zaidmadanat.com");
    await expect(post).toContainText("Projects · Apr 30 ·");
  });

  test("Get in touch has Email me and Book a call", async ({ page }) => {
    await page.goto("/");
    const band = section(page, "Got a project, a question, or a film rec?");
    await expect(band.getByText(/always open to discussing projects/)).toBeVisible();
    await expect(band.getByRole("link", { name: "Email me" })).toHaveAttribute(
      "href",
      "mailto:zaidsmadanat@gmail.com",
    );
    await expect(band.getByRole("link", { name: "Book a call" })).toHaveAttribute("href", "/contact");
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("home, empty database", () => {
  test("Strava shows its empty state and Lately hides", async ({ page }) => {
    await page.goto(`${EMPTY_URL}/`);
    await expect(page.getByRole("heading", { level: 1, name: "Hi, I'm Zaid." })).toBeVisible();
    await expect(page.getByRole("article", { name: "Ajir" })).toBeVisible();
    await expect(
      section(page, "Off the keyboard").getByText("No activities in the last two weeks."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lately" })).toHaveCount(0);
    await expect(page.getByText(/Last watched|On repeat|Latest post/)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Got a project, a question, or a film rec?" }),
    ).toBeVisible();
  });
});

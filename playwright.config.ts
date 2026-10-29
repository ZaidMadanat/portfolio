import { defineConfig, devices } from "@playwright/test";
import { SEEDED_URL } from "./e2e/support/servers";

/** Specs that change what public pages show (see the "writes" project). */
const WRITES = /admin-(editor|review|favourites)\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: SEEDED_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Creates the e2e admin and intruder accounts once (e2e/admin.setup.ts).
    { name: "setup", testMatch: /\.setup\.ts$/ },
    { name: "chromium", dependencies: ["setup"], testIgnore: WRITES, use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      dependencies: ["setup"],
      testIgnore: WRITES,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    // Specs that publish to public pages run last, once every other spec is
    // done, so those still see exactly the seeded posts. They tidy up after
    // themselves (unpublish), so a reused local server stays seeded too.
    //
    // One worker: these specs save in the admin and then load the static page
    // the save expired. Run in parallel, one spec's load can re-render that page
    // from rows read just before another spec's save; Next stamps the entry when
    // it is stored, after that save's updateTag, so the next load gets the old
    // rows (seen as /reviews keeping the previous favourites).
    {
      name: "writes",
      dependencies: ["chromium", "mobile"],
      testMatch: WRITES,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Prepares the e2e databases, builds twice and serves the seeded build on
  // 3100 and the empty-database build on 3101 (e2e/support/web-server.ts).
  // Locally a server already on 3100 is reused, so stop stale ones on 3100 and
  // 3101 first.
  webServer: {
    command: "npx tsx e2e/support/web-server.ts",
    url: SEEDED_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

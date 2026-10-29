import { defineConfig, devices } from "@playwright/test";
import { SEEDED_URL } from "./e2e/support/servers";

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
    { name: "chromium", dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
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

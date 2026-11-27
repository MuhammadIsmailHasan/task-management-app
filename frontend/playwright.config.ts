import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests (MVP: login and register). They run against a running stack: the Backend on :5001 seeded with
 * `flask seed-data` (SEED_PASSWORD, default 12345678) and the Frontend on :3000 (`npm run dev` or `next start`).
 * The browser is the locally installed Google Chrome, so no Playwright browser download is needed.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  // `next dev` compiles a page on its first visit, so a redirect can take longer than the 5 second default
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE ?? "http://localhost:3000",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
});

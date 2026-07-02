const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-e2e.js",
    url: "http://127.0.0.1:3210/api/health",
    timeout: 60_000,
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

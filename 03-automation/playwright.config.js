const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const rootDir = path.resolve(__dirname, "..");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(rootDir, "05-reports", "results.json") }],
    ["html", { outputFolder: path.join(rootDir, "05-reports", "html"), open: "never" }]
  ],
  outputDir: path.join(rootDir, "04-evidence", "test-artifacts"),
  use: {
    baseURL: process.env.BASE_URL || "https://demo.owasp-juice.shop",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});

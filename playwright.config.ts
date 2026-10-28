import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    channel: process.platform === "win32" ? "chrome" : undefined,
    headless: true,
  },
  reporter: "list",
  timeout: 45000,
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});

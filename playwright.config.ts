import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5179", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", trace: "retain-on-failure" },
  webServer: { command: "node scripts/test-dev.mjs", url: "http://127.0.0.1:5179/api/health", reuseExistingServer: false, timeout: 30000 },
});

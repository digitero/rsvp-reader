import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;
const BASE = "/rsvp-reader/";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    },
  ],
  // 本番と同じサブパスでビルドしたものを配信して確かめる
  webServer: {
    command: `BASE_PATH=${BASE} npx vite build && npx vite preview --base ${BASE} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

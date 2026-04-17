import "dotenv/config";
import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const webBaseUrl = process.env.WEB_BASE_URL ?? "http://127.0.0.1:4173";
const videoMode: "off" | "retain-on-failure" =
  process.env.PLAYWRIGHT_VIDEO === "retain-on-failure" ? "retain-on-failure" : "off";
const localChromeExecutablePath =
  process.platform === "darwin"
  && existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : null;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: videoMode,
  },
  webServer: isDeployedRun
    ? undefined
    : [
        {
          command: "bash scripts/e2e-start-api.sh",
          url: "http://127.0.0.1:8787/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @relaynews/web run dev -- --host 127.0.0.1 --port 4173",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @relaynews/admin run dev -- --host 127.0.0.1 --port 4174",
          url: "http://127.0.0.1:4174",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(localChromeExecutablePath
          ? {
              channel: undefined,
              launchOptions: {
                executablePath: localChromeExecutablePath,
              },
            }
          : {}),
      },
    },
  ],
});

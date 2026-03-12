// playwright.config.ts - Playwright E2E test configuration.
// Builds and previews the app on a fixed port before running tests; retries twice on CI.
// Targets desktop-first projects: Chromium baseline, Firefox, and a legacy 2015 UA desktop profile.
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const LEGACY_CHROME_41_USER_AGENT =
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';

const LEGACY_DESKTOP_DEVICE = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 800 },
  userAgent: LEGACY_CHROME_41_USER_AGENT,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${port} --strictPort`,
    port,
    timeout: 120000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'legacy-chrome-41',
      use: { ...LEGACY_DESKTOP_DEVICE },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json';

/**
 * Smoke coverage for the golden path. The dev server is used deliberately:
 * demo state is process-local, so the tests need the same process throughout.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    // Signs in to the back office once and records the browser state the two
    // real projects start from — every /admin route is behind a session.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ADMIN_STORAGE_STATE },
    },
    // Chromium-based so the suite needs only one browser download.
    {
      name: 'mobile',
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, storageState: ADMIN_STORAGE_STATE },
    },
    {
      name: 'tablet',
      dependencies: ['setup'],
      // The broader suite targets desktop and phone viewports. Keep tablet
      // coverage to the modal audit, which explicitly exercises 820px.
      testMatch: /mobile-modals\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 820, height: 1180 }, storageState: ADMIN_STORAGE_STATE },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

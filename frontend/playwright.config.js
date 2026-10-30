// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * VendSphere Playwright E2E Configuration
 * Configured initially for Chromium testing against the local Vite frontend.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  expect: {
    timeout: 7000
  },
  /* Run tests sequentially to ensure stable UI & auth state */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on failure in CI */
  retries: process.env.CI ? 1 : 0,
  /* Reporter to use: interactive list output + detailed HTML report */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  /* Shared settings for all projects */
  use: {
    /* Base URL pointing to the local Vite frontend */
    baseURL: 'http://localhost:5173',
    /* Collect trace only on retry */
    trace: 'on-first-retry',
    /* Capture screenshots on test failure */
    screenshot: 'only-on-failure',
    /* Viewport settings */
    viewport: { width: 1280, height: 720 },
    /* Action timeout */
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
  },

  /* Configure Chromium only as requested */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      },
    },
  ],

  /* Run local dev server before starting tests if not already active */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});

import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for E2E testing of the Tauri desktop application.
 *
 * To run tests:
 * - npm run test:e2e
 *
 * Tests will build the Tauri app and launch it for testing.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Tauri tests should run serially
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60000, // Tauri startup can be slow
  expect: {
    timeout: 10000,
  },
  projects: [
    {
      name: 'tauri-e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/',
})

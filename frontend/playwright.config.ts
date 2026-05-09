import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env['CI']

export default defineConfig({
  testDir: './playwright/e2e',
  outputDir: './test-results',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})

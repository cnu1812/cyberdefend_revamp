import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/browser-tests',
  timeout: 15_000,
  use: {
    browserName: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
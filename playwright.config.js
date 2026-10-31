import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/browser-tests',
  timeout: 15_000,
  use: {
  browserName: 'chromium',
  headless: true,
  ignoreHTTPSErrors: true,
},
});
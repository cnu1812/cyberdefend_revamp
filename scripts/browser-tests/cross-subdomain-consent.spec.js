import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const analyticsSource = readFileSync(
  new URL('../../src/assets/analytics.js', import.meta.url),
  'utf8'
);

const testAnalyticsSource = analyticsSource.replaceAll(
  'cyberdefend.in',
  'cyberdefend.test'
);

const domains = [
  'cyberdefend.test',
  'academy.cyberdefend.test',
  'services.cyberdefend.test',
];

test('accepted consent cookie is shared across local test subdomains', async ({
  browser,
}) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  await context.route('https://**/*', async route => {
    const url = new URL(route.request().url());

    if (domains.includes(url.hostname)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html>
          <html>
            <head><title>Local consent test</title></head>
            <body>
              <button type="button" data-analytics-settings>
                Analytics settings
              </button>
            </body>
          </html>`,
      });
      return;
    }

    await route.abort();
  });

  await context.grantPermissions([], {
    origin: 'https://cyberdefend.test',
  });

  const page = await context.newPage();

  try {
    // Seed the browser with the test origin and consent script.
    // Route interception keeps all page content local to this test.
    await page.goto('https://cyberdefend.test/');
    await page.addScriptTag({ content: testAnalyticsSource });

    await page.getByRole('button', { name: 'Accept analytics' }).click();

    for (const domain of domains) {
      await page.goto(`https://${domain}/`);

      const consent = await page.evaluate(() =>
        document.cookie
          .split('; ')
          .find(cookie => cookie.startsWith('cd_analytics_consent='))
      );

      expect(consent, `Consent missing on ${domain}`).toBe(
        'cd_analytics_consent=accepted'
      );
    }
  } finally {
    await context.close();
  }
});
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const analyticsSource = readFileSync(
  new URL('../../src/assets/analytics.js', import.meta.url),
  'utf8'
);

const domains = [
  'cyberdefend.in',
  'academy.cyberdefend.in',
  'services.cyberdefend.in',
];

test('consent cookie is shared across all three HTTPS subdomains', async ({
  page,
}) => {
  await page.route('https://www.googletagmanager.com/**', route =>
    route.abort()
  );

  for (const domain of domains) {
    await page.route(`https://${domain}/**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html>
          <html>
            <head><title>Consent test</title></head>
            <body>
              <button type="button" data-analytics-settings>
                Analytics settings
              </button>
            </body>
          </html>`,
      })
    );
  }

  await page.goto('https://cyberdefend.in/');
  await page.addScriptTag({ content: analyticsSource });

  await expect(
    page.getByRole('button', { name: 'Accept analytics' })
  ).toBeVisible();

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
});
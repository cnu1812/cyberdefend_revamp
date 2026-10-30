import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const analyticsSource = readFileSync(
  new URL('../../src/assets/analytics.js', import.meta.url),
  'utf8'
);

const testAnalyticsSource = analyticsSource
  .replace(
    "'services.cyberdefend.in'];",
    "'services.cyberdefend.in', '127.0.0.1'];"
  )
  .replace(
    '; Domain=cyberdefend.in; Secure; SameSite=Lax',
    '; Secure; SameSite=Lax'
  );

test.beforeEach(async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route =>
    route.abort()
  );

  await page.goto('http://127.0.0.1:4173/');

  await page.addScriptTag({ content: testAnalyticsSource });
});

test('shows consent choices when no preference exists', async ({ page }) => {
  const panel = page.locator('.analytics-consent');

  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Accept analytics' })
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Reject analytics' })
  ).toBeVisible();
});

test('rejecting analytics saves the choice and hides the panel', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Reject analytics' }).click();

  await expect(page.locator('.analytics-consent')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => document.cookie))
    .toContain('cd_analytics_consent=declined');

  expect(
    await page.evaluate(() => window.dataLayer.filter(
      args => args[0] === 'config'
    ).length)
  ).toBe(0);
});

test('accepting analytics loads one Google tag script', async ({ page }) => {
  await page.getByRole('button', { name: 'Accept analytics' }).click();

  await expect(page.locator('.analytics-consent')).toBeHidden();

  await expect
    .poll(() =>
      page.locator('script[src*="googletagmanager.com/gtag/js"]').count()
    )
    .toBe(1);

  expect(
    await page.evaluate(() => window.dataLayer.filter(
      args => args[0] === 'config'
    ).length)
  ).toBe(1);

  await page.locator('[data-analytics-settings]').click();
  await page.getByRole('button', { name: 'Accept analytics' }).click();

  await expect(
    page.locator('script[src*="googletagmanager.com/gtag/js"]')
  ).toHaveCount(1);
});

test('rejecting analytics persists across a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Reject analytics' }).click();
  await page.reload();

  await page.addScriptTag({ content: testAnalyticsSource });

  await expect(page.locator('.analytics-consent')).toBeHidden();

  expect(
    await page.evaluate(() => window.dataLayer.filter(
      args => args[0] === 'config'
    ).length)
  ).toBe(0);
});

test('withdrawal stops future custom event tracking', async ({ page }) => {
  await page.getByRole('button', { name: 'Accept analytics' }).click();

  await page.locator('[data-analytics-settings]').click();
  await page.getByRole('button', { name: 'Reject analytics' }).click();

  const eventCountBefore = await page.evaluate(() =>
    window.dataLayer.filter(args => args[0] === 'event').length
  );

  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent('cyberdefend:enquiry-success')
    );
  });

  const eventCountAfter = await page.evaluate(() =>
    window.dataLayer.filter(args => args[0] === 'event').length
  );

  expect(eventCountAfter).toBe(eventCountBefore);
});

test('custom analytics events exclude URL query and fragment values', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Accept analytics' }).click();

  await page.evaluate(() => {
    history.replaceState(
      {},
      '',
      '/?email=private@example.com&token=secret123#private-fragment'
    );

    document.dispatchEvent(
      new CustomEvent('cyberdefend:enquiry-success')
    );
  });

  const payloads = await page.evaluate(() =>
    window.dataLayer
      .filter(args => args[0] === 'event' || args[0] === 'config')
      .map(args => JSON.stringify(args))
      .join('\n')
  );

  expect(payloads).not.toContain('private@example.com');
  expect(payloads).not.toContain('secret123');
  expect(payloads).not.toContain('private-fragment');
});

test('footer analytics preferences can be opened with the keyboard', async ({
  page,
}) => {
  const settings = page.locator('[data-analytics-settings]');

  await settings.focus();
  await expect(settings).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(page.locator('.analytics-consent')).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Accept analytics' })
  ).toBeFocused();
});
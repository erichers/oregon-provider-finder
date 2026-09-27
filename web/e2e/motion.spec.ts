import { expect, test } from '@playwright/test';

async function results(page: import('@playwright/test').Page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/facets')) {
      await route.fulfill({ json: { groups: [], specialties: [], credentials: [] } });
      return;
    }
    if (url.includes('/api/providers')) {
      await route.fulfill({
        json: {
          total: 1,
          page: 1,
          pageSize: 20,
          center: null,
          items: [{
            npi: '1548266448',
            fullName: 'Neda Lynne Grant',
            credentialText: 'LPC',
            primarySpecialty: 'Counselor',
            groups: ['counselor'],
            city: 'SALEM',
            zip5: '97301',
            phone: null,
            distanceMiles: null,
            locationPrecision: 'Zip',
            addressLine1: null,
            lat: 44.94,
            lng: -123.03,
          }],
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });
  await page.goto('/?q=grant');
  await expect(page.locator('.result').first()).toBeVisible();
}

test('reduced motion keeps result cards still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await results(page);
  const name = await page.locator('.result').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
  const sheet = await page.locator('.drawer-sheet').evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(sheet).toBe('none');
});

test('result cards rise when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await results(page);
  const name = await page.locator('.result').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('rise');
});

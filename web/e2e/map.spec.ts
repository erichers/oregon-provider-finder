import { expect, test } from '@playwright/test';

test('a marker selects its card and a card selects its marker', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/providers/map')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.includes('/api/facets')) {
      await route.fulfill({ json: { groups: [], specialties: [], credentials: [] } });
      return;
    }
    if (url.includes('/api/providers')) {
      await route.fulfill({
        json: {
          total: 2,
          page: 1,
          pageSize: 20,
          center: null,
          items: [
            {
              npi: '1548266448',
              fullName: 'Neda Lynne Grant',
              credentialText: 'MA, LPC',
              primarySpecialty: 'Counselor',
              groups: ['counselor'],
              city: 'SALEM',
              zip5: '97301',
              phone: '5035550100',
              distanceMiles: 1.2,
              locationPrecision: 'Zip',
              addressLine1: '123 STATE ST',
              lat: 44.94,
              lng: -123.03,
            },
            {
              npi: '1003827965',
              fullName: 'Amy W Wagner',
              credentialText: 'PHD',
              primarySpecialty: 'Psychologist',
              groups: ['psychologist'],
              city: 'PORTLAND',
              zip5: '97239',
              phone: '5032208262',
              distanceMiles: 40,
              locationPrecision: 'Zip',
              addressLine1: '3710 SW US VETERANS HOSPITAL RD',
              lat: 45.51,
              lng: -122.68,
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });

  const logs: string[] = [];
  page.on('pageerror', (err) => logs.push(err.message));
  await page.goto('/?q=grant');
  await expect(page.getByRole('link', { name: /Grant/ })).toBeVisible();
  if (await page.locator('.map-frame').count() === 0) {
    await page.getByRole('button', { name: 'Map' }).click();
  }
  await expect(page.locator('.map-frame')).toBeVisible();
  await expect(page.locator('.map-frame')).toHaveAttribute('data-count', '2', { timeout: 15000 });
  const pin = page.locator('.pin').first();
  await expect(pin).toBeVisible();
  expect(logs).toEqual([]);
  await pin.click();
  await expect(page.locator('.map-popup a')).toHaveText('Profile');
  const selected = await page.locator('a.result.selected').getAttribute('id');
  const cards = ['result-1548266448', 'result-1003827965'];
  expect(cards).toContain(selected);
  const other = cards.find((id) => id !== selected);
  expect(other).toBeTruthy();
  await page.locator('#' + other).hover();
  await expect(page.locator('#' + other)).toHaveClass(/selected/);
  await expect(page.locator('.pin-wrap.selected')).toHaveCount(1);
});

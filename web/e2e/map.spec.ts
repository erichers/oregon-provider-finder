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
    if (/\/api\/providers\/\d+/.test(url)) {
      await route.fulfill({
        json: {
          npi: '1548266448',
          fullName: 'Neda Lynne Grant',
          credentialText: 'MA, LPC',
          credentials: ['MA', 'LPC'],
          sex: 'F',
          addressLine1: '123 STATE ST',
          addressLine2: null,
          city: 'SALEM',
          zip5: '97301',
          phone: '5035550100',
          lat: 44.94,
          lng: -123.03,
          locationPrecision: 'Zip',
          groups: ['counselor'],
          primarySpecialty: 'Counselor',
          primaryTaxonomyCode: '101YM0800X',
          enumerationDate: null,
          registryLastUpdated: null,
          registryUrl: 'https://npiregistry.cms.hhs.gov/provider-view/1548266448',
          taxonomies: [],
        },
      });
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
  await expect(page.locator('.result-hit', { hasText: 'Grant' })).toBeVisible();
  await expect(page.locator('.map-frame')).toBeVisible();
  await expect(page.locator('.map-frame')).toHaveAttribute('data-count', '2', { timeout: 15000 });
  const pin = page.locator('.pin').first();
  await expect(pin).toBeVisible();
  expect(logs).toEqual([]);
  await pin.click();
  await expect(page.locator('.map-popup a')).toHaveText('Profile');
  const selected = await page.locator('article.result.selected').getAttribute('id');
  const cards = ['result-1548266448', 'result-1003827965'];
  expect(cards).toContain(selected);
  const other = cards.find((id) => id !== selected);
  expect(other).toBeTruthy();
  await page.locator('#' + other).hover();
  await expect(page.locator('#' + other)).toHaveClass(/selected/);
  await expect(page.locator('.pin-wrap.selected')).toHaveCount(1);
});

test('moving the map searches the visible area', async ({ page }) => {
  let sawBounds = false;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('minLat=')) {
      sawBounds = true;
    }
    if (url.includes('/api/providers')) {
      await route.fulfill({ json: { total: 0, page: 1, pageSize: 40, center: null, items: [] } });
      return;
    }
    await route.fulfill({ json: { groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/');
  await expect.poll(() => sawBounds).toBe(true);
});

test('the phone sheet opens further from the handle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ json: { total: 0, page: 1, pageSize: 40, center: null, items: [], groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/');
  const sheet = page.locator('.drawer-sheet');
  await expect(sheet).toBeVisible();
  const before = await sheet.evaluate((el) => el.getBoundingClientRect().height);
  await page.getByRole('button', { name: 'Providers' }).click();
  await expect.poll(async () => sheet.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(before + 40);
});

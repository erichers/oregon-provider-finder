import { expect, test } from '@playwright/test';

test('the search page shows a result and the crisis line', async ({ page }) => {
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
          total: 1,
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
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.goto('/?q=grant');
  await expect(page.getByText('In crisis?')).toBeVisible();
  await expect(page.locator('.result-hit', { hasText: 'Neda Lynne Grant' })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Sort')).toHaveValue('relevance');
});

test('load more appends the next page', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/providers')) {
      const pageNumber = new URL(url).searchParams.get('page');
      const second = pageNumber === '2';
      await route.fulfill({
        json: {
          total: 2,
          page: second ? 2 : 1,
          pageSize: 40,
          center: null,
          items: [{
            npi: second ? '1003827965' : '1548266448',
            fullName: second ? 'Amy W Wagner' : 'Neda Lynne Grant',
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
    await route.fulfill({ json: { groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/?q=grant');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.result-hit', { hasText: 'Amy W Wagner' })).toBeVisible();
});

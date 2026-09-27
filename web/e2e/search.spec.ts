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
  await expect(page.getByRole('link', { name: /Neda Lynne Grant/ })).toBeVisible();
});

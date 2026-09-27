import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function stub(page: import('@playwright/test').Page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/providers/1548266448')) {
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
          enumerationDate: '2007-07-08',
          registryLastUpdated: '2007-07-08',
          registryUrl: 'https://npiregistry.cms.hhs.gov/provider-view/1548266448',
          taxonomies: [{ code: '101YM0800X', displayName: 'Counselor', isPrimary: true, licenseNumber: 'C1234', licenseState: 'OR' }],
        },
      });
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
            credentialText: 'MA, LPC',
            primarySpecialty: 'Counselor',
            groups: ['counselor'],
            city: 'SALEM',
            zip5: '97301',
            phone: '5035550100',
            distanceMiles: null,
            locationPrecision: 'Zip',
            addressLine1: '123 STATE ST',
            lat: 44.94,
            lng: -123.03,
          }],
        },
      });
      return;
    }
    if (url.includes('/api/facets')) {
      await route.fulfill({ json: { groups: [], specialties: [], credentials: [] } });
      return;
    }
    if (url.includes('/api/meta')) {
      await route.fulfill({ json: { dataAsOf: '2026-09-13', providerCount: 64780, lastImport: null } });
      return;
    }
    await route.fulfill({ json: {} });
  });
}

async function serious(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
}

test('search, results, and a profile have no serious accessibility violations', async ({ page }) => {
  // A mid-fade sample blends the type into the page and fails contrast.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Oregon Provider Finder' })).toBeVisible();
  expect(await serious(page)).toEqual([]);

  await page.goto('/?q=grant');
  await expect(page.locator('.result-hit', { hasText: 'Grant' })).toBeVisible();
  expect(await serious(page)).toEqual([]);

  await page.goto('/provider/1548266448');
  await expect(page.getByRole('heading', { name: /Grant/ })).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

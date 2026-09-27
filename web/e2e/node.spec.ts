import { expect, test, type Page } from '@playwright/test';

function person(npi: string, name: string, specialty: string) {
  return {
    npi,
    fullName: name,
    credentialText: 'MA, LPC',
    primarySpecialty: specialty,
    groups: ['counselor'],
    city: 'SALEM',
    zip5: '97301',
    phone: '5035550100',
    distanceMiles: 1.2,
    locationPrecision: 'Zip',
    addressLine1: '123 STATE ST',
    lat: 45.52,
    lng: -122.67,
  };
}

async function stub(page: Page) {
  const items = [
    person('1548266448', 'Neda Lynne Grant', 'Counselor'),
    person('1003827965', 'Amy W Wagner', 'Psychologist'),
  ];
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/facets') || url.includes('/api/providers/map')) {
      await route.fulfill({ json: url.includes('/api/facets') ? { groups: [], specialties: [], credentials: [] } : [] });
      return;
    }
    if (/\/api\/providers\/\d+/.test(url)) {
      await route.fulfill({
        json: {
          ...items[0],
          credentials: ['MA', 'LPC'],
          sex: 'F',
          addressLine2: null,
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
      await route.fulfill({ json: { total: items.length, page: 1, pageSize: 20, center: null, items } });
      return;
    }
    await route.fulfill({ json: {} });
  });
}

async function alpha(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const color = getComputedStyle(el).backgroundColor;
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) {
      return color === 'transparent' ? 0 : 1;
    }
    const parts = match[1].split(',').map((part) => part.trim());
    return parts.length === 4 ? Number(parts[3]) : 1;
  });
}

async function nodeStays(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await stub(page);
  await page.goto('/?q=grant');
  await expect(page.locator('.map-frame')).toHaveAttribute('data-count', '2', { timeout: 15000 });
  await page.getByRole('button', { name: '2', exact: true }).click();
  const label = page.locator('.drawer-count');
  await expect(label).toHaveText('2 providers near Salem');
  await expect(page.locator('.drawer-toggle')).toHaveAttribute('aria-expanded', 'true');
  const names = await page.locator('.result-hit strong').allTextContents();
  expect(names).toEqual(['Neda Lynne Grant', 'Amy W Wagner']);

  await page.locator('.drawer-scroll').evaluate((el) => {
    const scroller = el as HTMLElement;
    scroller.style.maxHeight = '90px';
    scroller.tabIndex = -1;
    scroller.focus();
  });
  await page.keyboard.press('PageDown');
  await expect.poll(async () => page.locator('.drawer-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.locator('.drawer-scroll').evaluate((el) => {
    (el as HTMLElement).style.maxHeight = '';
    el.scrollTop = 0;
  });

  const map = page.locator('.map-frame');
  const box = await map.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width * (width > 1000 ? 0.72 : 0.5);
  const y = box!.y + box!.height * (width > 1000 ? 0.4 : 0.22);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y + 30, { steps: 6 });
  await page.mouse.up();
  if (await page.locator('.leaflet-control-zoom-in').isVisible()) {
    await page.locator('.leaflet-control-zoom-in').click();
  }
  await page.waitForTimeout(800);
  await expect(label).toHaveText('2 providers near Salem');
  await expect(page.locator('.result-hit strong')).toHaveText(names);
  await expect(page.locator('.drawer-toggle')).toHaveAttribute('aria-expanded', 'true');

  const card = page.locator('.result-hit', { hasText: 'Grant' });
  await card.click();
  await expect(page.locator('.teaser')).toBeVisible();
  await expect(page.locator('.teaser')).toContainText('Counselor');
  await expect(page.locator('.teaser')).toContainText('Salem');
  await page.waitForTimeout(800);
  await expect(label).toHaveText('2 providers near Salem');
  await expect(page.locator('.result-hit strong')).toHaveText(names);

  await page.keyboard.press('Escape');
  await expect(page.locator('.teaser')).toHaveCount(0);
  await expect(card).toBeFocused();

  await card.click();
  await page.getByRole('button', { name: 'Close provider preview' }).click();
  await expect(page.locator('.teaser')).toHaveCount(0);
  await expect(card).toBeFocused();

  await card.click();
  await page.getByRole('link', { name: 'View full profile' }).click();
  await expect(page).toHaveURL(/\/provider\/1548266448/);
  await expect(page.locator('.provider-name')).toContainText('Grant');

  await page.goto('/?q=grant');
  await expect(page.locator('.result-hit').first()).toBeVisible();
  expect(await alpha(page, '.drawer')).toBe(0);
  expect(await alpha(page, '.drawer-sheet')).toBe(0);
  const shadow = await page.locator('.drawer').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toBe('none');
  expect(await alpha(page, '.result-hit')).toBeGreaterThan(0.8);
}

test('a map node keeps its list on a wide screen', async ({ page }) => {
  await nodeStays(page, 1440, 900);
});

test('a map node keeps its list on a phone', async ({ page }) => {
  await nodeStays(page, 390, 844);
});

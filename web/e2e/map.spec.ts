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
  const cards = ['result-1548266448', 'result-1003827965'];
  await page.locator('#result-1003827965').hover();
  await expect(page.locator('#result-1003827965')).toHaveClass(/selected/);
  await expect(page.locator('.pin-wrap.selected')).toHaveCount(1);
  await pin.click();
  await expect(page.locator('.teaser')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View full profile' })).toBeVisible();
  const selected = await page.locator('article.result.selected').getAttribute('id');
  expect(cards).toContain(selected);
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
  const toggle = page.locator('.drawer-toggle');
  const chevron = page.locator('.chevron');
  const height = () => sheet.evaluate((el) => el.getBoundingClientRect().height);
  await expect(sheet).toBeVisible();
  await expect(chevron).toHaveAttribute('data-dir', 'up');
  const peek = await height();
  await toggle.click();
  await expect(chevron).toHaveAttribute('data-dir', 'down');
  await expect.poll(height).toBeGreaterThan(peek + 200);
  const half = await height();
  await toggle.click();
  await expect(chevron).toHaveAttribute('data-dir', 'up');
  await expect.poll(height).toBeLessThan(peek + 40);
  await toggle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(chevron).toHaveAttribute('data-dir', 'down');
  await expect.poll(height).toBeGreaterThan(peek + 200);
  await page.keyboard.press('ArrowUp');
  await expect.poll(height).toBeGreaterThan(half + 200);
  const full = await height();
  await expect(chevron).toHaveAttribute('data-dir', 'down');
  await page.keyboard.press('ArrowDown');
  await expect.poll(height).toBeLessThan(full - 200);
  await expect.poll(height).toBeGreaterThan(peek + 200);
  await page.keyboard.press('ArrowDown');
  await expect(chevron).toHaveAttribute('data-dir', 'up');
  await expect.poll(height).toBeLessThan(peek + 40);
});

test('the desktop drawer collapses from the handle', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ json: { total: 0, page: 1, pageSize: 40, center: null, items: [], groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/');
  const toggle = page.locator('.drawer-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAttribute('aria-label', 'Hide provider list');
  await toggle.click();
  await expect(page.locator('.drawer')).toHaveClass(/closed/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Show provider list');
  await expect(toggle).toBeVisible();
  await expect(page.locator('.handle-bar')).toHaveCount(0);
});

test('care needs sit in one scrolling row and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ json: { total: 0, page: 1, pageSize: 40, center: null, items: [], groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/');
  const strip = page.locator('.filter-strip');
  await expect(strip).toBeVisible();
  expect(await strip.evaluate((el) => getComputedStyle(el).flexWrap)).toBe('nowrap');
  expect(await strip.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveAttribute('aria-expanded', 'false');
  const fit = await page.evaluate(() => {
    const title = document.querySelector('.wordmark');
    const zoom = document.querySelector('.leaflet-control-zoom');
    const row = document.querySelector('.filter-strip');
    if (!title || !zoom || !row) {
      return null;
    }
    const a = zoom.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    const hits = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    return {
      hits,
      title: title.scrollWidth - title.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(fit).not.toBeNull();
  expect(fit!.hits).toBe(false);
  expect(fit!.title).toBeLessThanOrEqual(1);
  expect(fit!.page).toBeLessThanOrEqual(1);
});

test('the phone bar stays one line and the full sheet clears the chips', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ json: { total: 0, page: 1, pageSize: 40, center: null, items: [], groups: [], specialties: [], credentials: [] } });
  });
  await page.goto('/');
  const mast = page.locator('.map-app .mast');
  const bar = await mast.evaluate((el) => {
    const crisis = el.querySelector('.crisis') as HTMLElement;
    return {
      height: el.getBoundingClientRect().height,
      overflow: el.scrollHeight - el.clientHeight,
      crisis: crisis.scrollWidth - crisis.clientWidth,
    };
  });
  expect(bar.height).toBeLessThanOrEqual(52);
  expect(bar.overflow).toBeLessThanOrEqual(1);
  expect(bar.crisis).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text 988' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'About the data' })).toBeVisible();
  await page.keyboard.press('Escape');

  const strip = page.locator('.filter-strip');
  await expect(strip).toHaveAttribute('data-fade', 'right');
  expect(await strip.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');
  expect(await strip.evaluate((el) => el.offsetHeight === el.clientHeight)).toBe(true);
  expect(await page.locator('.drawer-scroll').evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');
  await strip.evaluate((el) => {
    el.scrollLeft = 80;
    el.dispatchEvent(new Event('scroll'));
  });
  await expect(strip).toHaveAttribute('data-fade', 'both');
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
    el.dispatchEvent(new Event('scroll'));
  });
  await expect(strip).toHaveAttribute('data-fade', 'left');
  await page.addStyleTag({ content: '.filter-strip .chip { display: none !important; }' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(strip).toHaveAttribute('data-fade', 'none');

  const toggle = page.locator('.drawer-toggle');
  await toggle.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => {
    const head = document.querySelector('.drawer-head')!.getBoundingClientRect();
    const row = document.querySelector('.filter-strip')!.getBoundingClientRect();
    const zoom = getComputedStyle(document.querySelector('.leaflet-top.leaflet-right')!);
    const hits = head.right > row.left && head.left < row.right && head.bottom > row.top && head.top < row.bottom;
    return !hits && head.top >= row.bottom - 1 && zoom.opacity === '0' && zoom.pointerEvents === 'none';
  })).toBe(true);
});

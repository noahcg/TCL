import { test, expect } from '@playwright/test';

test('reading room search matches useful notes, restores its URL, and recovers from no results', async ({ page }) => {
  await page.goto('/resources/');
  const query = page.getByRole('searchbox', { name: 'Search resources', exact: true });
  await query.fill('illustrated edge cases');
  await expect(page.locator('[data-resource]:visible')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Ahmad Shadeed', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('illustrated edge cases');
  await page.reload();
  await expect(query).toHaveValue('illustrated edge cases');
  await expect(page.locator('[data-resource]:visible')).toHaveCount(1);
  await query.fill('nothing matches this phrase');
  await expect(page.getByRole('heading', { name: 'No resources found.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore all resources', exact: true }).click();
  await expect(page.locator('[data-resource]:visible')).toHaveCount(7);
  await expect(query).toBeFocused();
  expect(new URL(page.url()).search).toBe('');
  await query.fill('Kevin');
  await page.getByRole('navigation', { name: 'Resource categories' }).getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(query).toHaveValue('');
  await expect(page.locator('#documentation').getByRole('heading', { name: 'Documentation', exact: true })).toBeInViewport();
});

test('shortlist saves across reloads, combines with search, and handles its last removal by keyboard', async ({ page }) => {
  await page.goto('/resources/');
  const keep = page.getByRole('button', { name: 'Save MDN Web Docs', exact: true });
  await keep.focus();
  await keep.press('Enter');
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Save Ahmad Shadeed', exact: true }).click();
  await page.reload();
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.resource-saved-count')).toHaveText('2');
  const shortlist = page.getByRole('button', { name: 'Show your shortlist', exact: true });
  await shortlist.click();
  await expect(page.locator('[data-resource]:visible')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('saved')).toBe('1');
  const query = page.getByRole('searchbox', { name: 'Search resources', exact: true });
  await query.fill('MDN');
  await expect(page.locator('[data-resource]:visible')).toHaveCount(1);
  await page.reload();
  await expect(shortlist).toHaveAttribute('aria-pressed', 'true');
  await expect(query).toHaveValue('MDN');
  await page.getByRole('search', { name: 'Filter resources' }).getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Save Ahmad Shadeed', exact: true }).click();
  await keep.focus();
  await keep.press('Enter');
  await expect(shortlist).toBeFocused();
  await expect(page.getByRole('heading', { name: 'No saved resources.', exact: true })).toBeVisible();
  await expect(page.locator('.resource-saved-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Explore all resources', exact: true }).click();
  await expect(page.locator('[data-resource]:visible')).toHaveCount(7);
});

test('reading room remains searchable without storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable'); } });
  });
  await page.goto('/resources/?saved=1&q=MDN');
  await expect(page.locator('.resource-shortlist')).toBeHidden();
  await expect(page.locator('.resource-save:visible')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'MDN Web Docs', exact: true })).toBeVisible();
  await expect(page.locator('[data-resource]:visible')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search resources', exact: true }).fill('Kevin');
  await expect(page.getByRole('link', { name: 'Kevin Powell', exact: true })).toBeVisible();
});

test('shortlist recovers from malformed saved data and ignores stale resource IDs', async ({ page }) => {
  await page.goto('/resources/');
  await page.evaluate(() => localStorage.setItem('tcl-resource-shortlist', 'invalid JSON'));
  await page.reload();
  const keep = page.getByRole('button', { name: 'Save MDN Web Docs', exact: true });
  await expect(keep).toBeVisible();
  await keep.click();
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => localStorage.setItem('tcl-resource-shortlist', JSON.stringify(['mdn-web-docs', 'removed-resource', 'mdn-web-docs'])));
  await page.reload();
  await expect(page.locator('.resource-saved-count')).toHaveText('1');
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
});

test('all resources and category deep links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/resources/');
  await expect(page.locator('[data-resource]')).toHaveCount(7);
  await expect(page.getByRole('search', { name: 'Filter resources' })).toBeHidden();
  await expect(page.locator('.resource-save:visible')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Resource categories' }).getByRole('link', { name: 'Community', exact: true }).click();
  await expect(page).toHaveURL(/#community$/);
  await expect(page.locator('#community').getByRole('heading', { name: 'Community', exact: true })).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Lynn Fisher', exact: true })).toHaveAttribute('href', '/resources/lynn-fisher/');
  await context.close();
});

test('reading room reflows at 320px with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/resources/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.getByRole('link', { name: 'MDN Web Docs', exact: true })).toBeVisible();
});

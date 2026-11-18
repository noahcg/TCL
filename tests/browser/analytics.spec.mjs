import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { page as renderPage } from '../../src/build/pages.mjs';

const loader = await readFile(new URL('../../src/assets/analytics.js', import.meta.url), 'utf8');
const sdk = await readFile(new URL('../../node_modules/@vercel/analytics/dist/index.mjs', import.meta.url), 'utf8');
const { version } = JSON.parse(await readFile(new URL('../../node_modules/@vercel/analytics/package.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
const policy = config.headers.find(entry => entry.source === '/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;

test('local previews do not initialize production analytics', async ({ page }) => {
  const analyticsRequests = [];
  page.on('request', request => {
    if (/\/assets\/(analytics|vercel-analytics)\.js|\/_vercel\/insights\//.test(request.url())) analyticsRequests.push(request.url());
  });
  for (const path of ['/', '/articles/', '/quick-wins/', '/resources/', '/search/']) {
    await page.goto(path);
    await expect(page.locator('script[src="/assets/analytics.js"]')).toHaveCount(0);
  }
  expect(analyticsRequests).toEqual([]);
});

test('the production loader injects the installed SDK with the existing content security policy', async ({ page }) => {
  const origin = 'https://analytics.example';
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': policy },
      body: renderPage({ path: '/', body: '<h1>Analytics test</h1>', analytics: true, siteUrl: origin }) });
    if (path === '/assets/analytics.js') return route.fulfill({ contentType: 'text/javascript', body: loader });
    if (path === '/assets/vercel-analytics.js') return route.fulfill({ contentType: 'text/javascript', body: sdk });
    if (path === '/_vercel/insights/script.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.analyticsScriptLoaded = true;' });
    return route.fulfill({ status: 204 });
  });
  await page.goto(origin);
  const script = page.locator('script[src="/_vercel/insights/script.js"]');
  await expect(script).toHaveAttribute('data-sdkn', '@vercel/analytics');
  await expect(script).toHaveAttribute('data-sdkv', version);
  await expect.poll(() => page.evaluate(() => window.analyticsScriptLoaded)).toBe(true);
  expect(await page.evaluate(() => window.vam)).toBe('production');
});

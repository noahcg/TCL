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

for (const storageBlocked of [false, true]) {
  test(`owner exclusion prevents SDK loading and handles storage blocked=${storageBlocked}`, async ({ page }) => {
    const origin = 'https://analytics.example';
    let sdkRequests = 0;
    await page.route(`${origin}/**`, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/' || path === '/articles/') return route.fulfill({ contentType:'text/html', headers:{'Content-Security-Policy':policy}, body:renderPage({path,body:'<h1>Analytics preference test</h1>',analytics:true,siteUrl:origin}) });
      if (path === '/assets/analytics.js') return route.fulfill({contentType:'text/javascript',body:loader});
      if (path === '/assets/vercel-analytics.js') return route.fulfill({contentType:'text/javascript',body:sdk});
      if (path === '/_vercel/insights/script.js') {
        sdkRequests++;
        return route.fulfill({contentType:'text/javascript',body:'window.analyticsScriptLoaded = true;'});
      }
      return route.fulfill({status:204});
    });
    if (storageBlocked) await page.addInitScript(() => {
      Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});
    });
    await page.goto(`${origin}/?analytics=off&keep=yes#main-content`);
    await expect(page.getByRole('status')).toContainText(storageBlocked ? 'could not be saved' : 'excluded from analytics');
    await expect(page).toHaveURL(`${origin}/?keep=yes#main-content`);
    expect(sdkRequests).toBe(0);
    if (storageBlocked) return;
    expect(await page.evaluate(() => localStorage.getItem('va-disable'))).toBe('1');
    await page.getByRole('button',{name:'Dismiss',exact:true}).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.goto(`${origin}/articles/`);
    // The module has completed initialization when its imported SDK helper exists.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('va-disable'))).toBe('1');
    expect(sdkRequests).toBe(0);
    await page.goto(`${origin}/?analytics=on`);
    await expect(page.getByRole('status')).toContainText('enabled again');
    await expect.poll(() => sdkRequests).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('va-disable'))).toBe(null);
    // The beforeSend hook also rejects events if exclusion is enabled after injection.
    expect(await page.evaluate(() => {
      localStorage.setItem('va-disable','1');
      const hook=window.vaq.find(args => args[0]==='beforeSend')[1];
      return hook({type:'pageview',url:location.href});
    })).toBe(null);
  });
}

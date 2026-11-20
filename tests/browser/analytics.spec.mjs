import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { page as renderPage } from '../../src/build/pages.mjs';

const loader = await readFile(new URL('../../src/assets/analytics.js', import.meta.url), 'utf8');
const sdk = await readFile(new URL('../../node_modules/@vercel/analytics/dist/index.mjs', import.meta.url), 'utf8');
const { version } = JSON.parse(await readFile(new URL('../../node_modules/@vercel/analytics/package.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
const policy = config.headers.find(entry => entry.source === '/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
const origin = 'https://analytics.example';
const measurementId = 'G-6XZZLW4VFL';
const commands = page => page.evaluate(() => (window.dataLayer || []).map(args => Array.from(args)));

async function mockProduction(page, { analytics = true, gaMeasurementId = measurementId, protocol = 'https:', blockGoogle = false } = {}) {
  const requests = { google: [], vercel: [], collections: [] };
  const base = origin.replace('https:', protocol);
  await page.addInitScript(() => {
    window.policyViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.policyViolations.push(event.blockedURI));
  });
  // Intercept vendor requests so tests never record visits in the live property.
  await page.route('https://www.googletagmanager.com/**', route => {
    requests.google.push(route.request().url());
    if (blockGoogle) return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: `window.googleTagLoaded = true;
      fetch('https://region1.google-analytics.com/g/collect', { method: 'POST', mode: 'no-cors', body: '' });` });
  });
  await page.route('https://*.google-analytics.com/**', route => {
    requests.collections.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  await page.route(`${base}/**`, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/assets/analytics.js') return route.fulfill({ contentType: 'text/javascript', body: loader });
    if (path === '/assets/vercel-analytics.js' || path.startsWith('/_vercel/insights/')) requests.vercel.push(path);
    if (path === '/assets/vercel-analytics.js') return route.fulfill({ contentType: 'text/javascript', body: sdk });
    if (path === '/_vercel/insights/script.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.analyticsScriptLoaded = true;' });
    if (!path.includes('.')) return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': policy },
      body: renderPage({ path, title: path, body: '<h1>Analytics test</h1>', analytics, gaMeasurementId, siteUrl: base }) });
    if (path.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: '' });
    return route.fulfill({ status: 204 });
  });
  return requests;
}

test('local previews do not initialize production analytics', async ({ page }) => {
  const analyticsRequests = [];
  page.on('request', request => {
    if (/\/assets\/(analytics|vercel-analytics)\.js|\/_vercel\/insights\/|googletagmanager|google-analytics/.test(request.url())) analyticsRequests.push(request.url());
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
    const requests = await mockProduction(page);
    if (storageBlocked) await page.addInitScript(() => {
      Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});
    });
    await page.goto(`${origin}/?analytics=off&keep=yes#main-content`);
    await expect(page.getByRole('status')).toContainText(storageBlocked ? 'could not be saved' : 'excluded from analytics');
    await expect(page).toHaveURL(`${origin}/?keep=yes#main-content`);
    expect(requests.vercel).toEqual([]);
    expect(requests.google).toEqual([]);
    expect(await page.evaluate(id => window[`ga-disable-${id}`], measurementId)).toBe(true);
    if (storageBlocked) return;
    expect(await page.evaluate(() => localStorage.getItem('va-disable'))).toBe('1');
    await page.getByRole('button',{name:'Dismiss',exact:true}).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.goto(`${origin}/articles/`);
    await expect.poll(() => page.evaluate(id => window[`ga-disable-${id}`], measurementId)).toBe(true);
    expect(requests.vercel).toEqual([]);
    expect(requests.google).toEqual([]);
    await page.goto(`${origin}/?analytics=on`);
    await expect(page.getByRole('status')).toContainText('enabled again');
    await expect.poll(() => page.evaluate(() => window.googleTagLoaded && window.analyticsScriptLoaded)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('va-disable'))).toBe(null);
    // The beforeSend hook also rejects events if exclusion is enabled after injection.
    expect(await page.evaluate(() => {
      localStorage.setItem('va-disable','1');
      const hook=window.vaq.find(args => args[0]==='beforeSend')[1];
      return hook({type:'pageview',url:location.href});
    })).toBe(null);
  });
}

test('GA4 queues consent before one automatic pageview configuration and loads asynchronously under CSP', async ({ page }) => {
  const requests = await mockProduction(page);
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => window.googleTagLoaded && window.analyticsScriptLoaded)).toBe(true);
  await expect(page.locator('#tcl-google-tag')).toHaveAttribute('async', '');
  expect(requests.google).toEqual([`https://www.googletagmanager.com/gtag/js?id=${measurementId}`]);
  const queued = await commands(page);
  expect(queued[0]).toEqual(['consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  }]);
  expect(queued.filter(args => args[0] === 'config')).toEqual([['config', measurementId, {
    send_page_view: true, allow_google_signals: false, allow_ad_personalization_signals: false,
  }]]);
  expect(queued.filter(args => args[0] === 'event' && args[1] === 'page_view')).toEqual([]);
  await expect.poll(() => requests.collections.length).toBe(1);
  expect(await page.evaluate(() => window.policyViolations)).toEqual([]);
  // An accidental second evaluation must not reconfigure or reload the tag.
  await page.evaluate(() => import('/assets/analytics.js?duplicate'));
  expect((await commands(page)).filter(args => args[0] === 'config')).toHaveLength(1);
  expect(requests.google).toHaveLength(1);
});

test('full-page navigation configures GA4 once on each destination', async ({ page }) => {
  const requests = await mockProduction(page);
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => window.googleTagLoaded)).toBe(true);
  for (const [label, path] of [['Articles', '/articles/'], ['Resources', '/resources/'], ['Search', '/search/']]) {
    await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(`${origin}${path}`);
    await expect.poll(() => page.evaluate(() => window.googleTagLoaded)).toBe(true);
    expect((await commands(page)).filter(args => args[0] === 'config')).toHaveLength(1);
    expect((await commands(page)).filter(args => args[0] === 'event' && args[1] === 'page_view')).toEqual([]);
  }
  expect(requests.google).toHaveLength(4);
});

test('non-Vercel production uses the configured ID without loading the Vercel SDK', async ({ page }) => {
  const requests = await mockProduction(page, { analytics: false, gaMeasurementId: 'G-OVERRIDE123' });
  await page.goto(`${origin}/articles/direct-entry/`);
  await expect.poll(() => page.evaluate(() => window.googleTagLoaded)).toBe(true);
  expect(requests.google).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-OVERRIDE123']);
  expect(requests.vercel).toEqual([]);
});

test('an empty GA4 configuration preserves Vercel Analytics alone', async ({ page }) => {
  const requests = await mockProduction(page, { gaMeasurementId: '' });
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => window.analyticsScriptLoaded)).toBe(true);
  expect(requests.google).toEqual([]);
  expect(await commands(page)).toEqual([]);
});

test('a production export stays quiet over local HTTP', async ({ page }) => {
  const requests = await mockProduction(page, { protocol: 'http:' });
  await page.goto(origin.replace('https:', 'http:'));
  await expect(page.locator('h1')).toBeVisible();
  expect(requests.google).toEqual([]);
  expect(requests.vercel).toEqual([]);
});

for (const signal of ['globalPrivacyControl', 'doNotTrack']) {
  test(`${signal} excludes both providers even with analytics=on`, async ({ page }) => {
    const requests = await mockProduction(page);
    await page.addInitScript(signal => Object.defineProperty(navigator, signal, { value: signal === 'globalPrivacyControl' ? true : '1' }), signal);
    await page.goto(`${origin}/?analytics=on`);
    await expect(page.getByRole('status')).toContainText('excluded from analytics');
    expect(requests.google).toEqual([]);
    expect(requests.vercel).toEqual([]);
  });
}

test('cross-tab exclusion stops GA4 and re-enabling does not duplicate initialization', async ({ page, context }) => {
  const requests = await mockProduction(page);
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => window.googleTagLoaded)).toBe(true);
  const other = await context.newPage();
  const otherRequests = await mockProduction(other);
  await other.goto(`${origin}/?analytics=off`);
  await expect.poll(() => page.evaluate(id => window[`ga-disable-${id}`], measurementId)).toBe(true);
  expect((await commands(page)).at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  expect(otherRequests.google).toEqual([]);
  await other.goto(`${origin}/?analytics=on`);
  await expect.poll(() => page.evaluate(id => window[`ga-disable-${id}`], measurementId)).toBe(false);
  expect((await commands(page)).at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  expect((await commands(page)).filter(args => args[0] === 'config')).toHaveLength(1);
  expect(requests.google).toHaveLength(1);
});

test('a blocked Google tag leaves navigation and Vercel Analytics working', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockProduction(page, { blockGoogle: true });
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => window.analyticsScriptLoaded)).toBe(true);
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/articles/`);
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

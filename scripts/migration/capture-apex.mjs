import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { assert, validateSnapshot } from '../../src/build/content.mjs';

const source = 'https://oracleapex.com/ords/r/nglushien/watercooler/';
const privateRoot = resolve('artifacts/migration');
const output = resolve(process.argv[2] ?? 'artifacts/migration/watercooler-capture.json');
assert(output.startsWith(privateRoot + sep), 'Write the capture beneath artifacts/migration/');

const browser = await chromium.launch();
let stage = 'open the public homepage';
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(12_000);
  await page.goto(source + 'home', { waitUntil: 'domcontentloaded' });
  stage = 'read the article archive';
  await page.getByRole('button', { name: 'Browse articles' }).click();
  await page.getByRole('heading', { name: 'At the Watercooler', exact: true }).waitFor();
  await page.locator('main a[href*="p2_slug="]').first().waitFor();
  const inventory = await page.evaluate(appBase => {
    const links = [...document.querySelectorAll('main a[href*="p2_slug="]')];
    const entries = links.map(link => {
      const url = new URL(link.href);
      if (!url.href.startsWith(appBase + 'article?')) throw new Error('Unexpected article destination');
      const item = link.closest('li');
      return {
        slug: url.searchParams.get('p2_slug'),
        title: link.textContent.trim(),
        summary: item.querySelector('h4').textContent.trim(),
        date: item.querySelector('.a-CardView-badgeValue').textContent.trim(),
      };
    });
    const pagination = [...document.querySelectorAll('main button, main a')].some(control =>
      control.getClientRects().length && /^(next|load more|next page)$/i.test((control.getAttribute('aria-label') || control.textContent).trim()));
    if (pagination) throw new Error('Archive now has pagination. Enumerate each page and reconcile the inventory.');
    return entries;
  }, source);
  assert(inventory.length && new Set(inventory.map(row => row.slug)).size === inventory.length, 'Missing or duplicate legacy slugs');

  const articles = [];
  for (const item of inventory) {
    stage = 'read an article from the archive';
    await page.getByRole('link', { name: item.title, exact: true }).click();
    await page.getByRole('heading', { level: 1, name: item.title, exact: true }).waitFor();
    await page.locator('main article').first().waitFor();
    const body = await page.evaluate(() => {
      const bodies = [...document.querySelectorAll('main article')].filter(node => !node.parentElement.closest('article'));
      if (bodies.length !== 1) throw new Error('Expected one article body');
      const node = bodies[0];
      return {
        body: node.innerHTML,
        code: [...node.querySelectorAll('pre')].map(code => code.textContent),
        ids: [...node.querySelectorAll('[id]')].map(element => element.id),
        heading: document.querySelector('h1').textContent.trim(),
        meta: [...document.querySelectorAll('.wc-articleHero__inner > *, main article time, main article [rel=author], meta[name=author]')]
          .map(element => [element.tagName, element.className, element.textContent.trim(), element.getAttribute('content')]),
        author: document.querySelector('meta[name=author]')?.getAttribute('content') || undefined,
      };
    });
    articles.push({ ...item, ...body });
    await page.getByRole('link', { name: 'Articles', exact: true }).click();
    await page.getByRole('heading', { name: 'At the Watercooler', exact: true }).waitFor();
  }

  stage = 'read Quick Wins';
  await page.getByRole('link', { name: 'Quick Wins', exact: true }).click();
  await page.locator('main article.qw-item').first().waitFor();
  const quick = await page.evaluate(() => [...document.querySelectorAll('main article.qw-item')].map(item => ({
    title: item.querySelector('h2').textContent.trim(),
    html: item.querySelector('.qw-item__main').innerHTML,
    summary: item.querySelector('.qw-item__summary')?.textContent.trim(),
    note: item.querySelector('.qw-item__note')?.textContent.trim(),
    code: item.querySelector('pre').textContent,
    tags: item.dataset.category?.split(/\s+/),
    difficulty: item.dataset.difficulty,
    metadata: item.querySelector('.qw-item__meta')?.textContent.trim(),
    date: item.querySelector('time')?.getAttribute('datetime'),
  })));

  stage = 'read Resources';
  await page.getByRole('link', { name: 'Resources', exact: true }).click();
  await page.locator('main .wc-resourceOrg').first().waitFor();
  const resources = await page.evaluate(() => [...document.querySelectorAll('main .wc-resourcePerson, main .wc-resourceOrg')].map(item => ({
    title: item.querySelector('h3,h2').textContent.trim(),
    kind: item.classList.contains('wc-resourceOrg') ? 'Reference' : 'Person',
    html: item.innerHTML,
    url: item.querySelector('a').href,
  })));

  const bundle = { articles, quick, resources, source, method: 'public-apex-rendered-dom', capturedOn: new Date().toISOString().slice(0, 10) };
  stage = 'verify and save the candidate';
  validateSnapshot(bundle, false);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Saved a candidate with ${articles.length} articles, ${quick.length} Quick Wins, and ${resources.length} resources.`);
} catch (error) {
  // Browser exceptions can include checksum-bound URLs.
  const networkCode = /net::ERR_[A-Z_]+/.exec(String(error.message))?.[0];
  console.error(`APEX capture could not ${stage}${networkCode ? ` (${networkCode})` : ''}. Check the public app and capture selectors before retrying.`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

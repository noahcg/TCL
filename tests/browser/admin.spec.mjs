import AxeBuilder from '@axe-core/playwright';
import { loadContent } from '../../src/build/content.mjs';
import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createAdminServer } from '../../src/admin/server.mjs';

const testStudio = test.extend({
  studio: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'tcl-board-'));
    const draft = { id: randomUUID(), ideaId: randomUUID(), type: 'quick-win', slug: 'a-draft-css-tip',
      title: 'A draft CSS tip', summary: 'A useful draft.', body: '```css\np { color: green; }\n```',
      code: 'p { color: green; }', note: '', difficulty: 'beginner', tags: ['css'],
      sources: [{ title: 'MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/color' }] };
    const article = { ...draft, id: randomUUID(), type: 'article', slug: 'published-article',
      title: 'Published article', publishedAt: '2026-01-01T12:00:00.000Z' };
    const quickWin = { ...draft, id: randomUUID(), slug: 'published-css-tip', title: 'Published CSS tip',
      publishedAt: '2026-01-02T12:00:00.000Z' };
    await mkdir(join(root, '.tcl-admin'));
    await mkdir(join(root, 'content'));
    const homepageConfig = { ...JSON.parse(await readFile('content/homepage-feature.json','utf8')), mode:'monthly', startMonth:'2026-11', pinned:'container-queries', queue:['container-queries','fluid-type','aspect-ratio'], schedule:{}, usedDemos:['container-queries'], usedArticles:['container-query-units'] };
    homepageConfig.features['fluid-type'].topic = 'Fluid typography';
    await writeFile(join(root, 'content/homepage-feature.json'), JSON.stringify(homepageConfig));
    await symlink(join(process.cwd(), 'dist'), join(root, 'dist'));
    await writeFile(join(root, '.tcl-admin/state.json'), JSON.stringify({ version: 1, scans: [],
      drafts: [draft, article, quickWin], releases: [{ id: randomUUID(), draftId: article.id, status: 'submitted',
        title: article.title, type: article.type, slug: article.slug, commit: 'a'.repeat(40),
        createdAt: article.publishedAt, submittedAt: article.publishedAt, checks: 'Passed',
        config: { repository: 'test/lounge', branch: 'main' }, files: [], diff: '', pushed: [] }] }));
    let failPublication = false;
    const server = await createAdminServer({ root, homepageBuilder: async () => {}, apiKey: 'test-only', inventoryLoader: () => loadContent(),
      publisher: async () => { if (failPublication) throw new Error('Publication failed for this test.'); },
      livePreparer: async () => {}, liveSubmitter: async () => {} });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      await use({ url: `http://127.0.0.1:${server.address().port}/admin/`, failPublication: () => { failPublication = true; } });
    } finally {
      await server.waitForIdle();
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  },
});

testStudio('published content leaves Drafts, has its own counts and filters, and stays separated after reload', async ({ page, studio }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(studio.url);
  await expect(page.locator('#draft-count')).toHaveText('1');
  await expect(page.locator('#published-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Drafts 1', exact: true }).click();
  await expect(page.locator('#board h3')).toHaveText(['A draft CSS tip']);
  await page.getByRole('button', { name: 'Published 2', exact: true }).click();
  await expect(page.locator('#board h3')).toHaveText(['Published CSS tip', 'Published article']);
  await expect(page.locator('#board')).toContainText('Added to local site');
  await expect(page.locator('#board')).toContainText('Sent for live deployment');
  await page.getByLabel('Content type').selectOption('article');
  await expect(page.locator('#board h3')).toHaveText(['Published article']);
  await page.getByRole('button', { name: 'View publication', exact: true }).click();
  await expect(page.locator('#live-review')).toBeVisible();
  await expect(page.locator('#live-status')).toContainText('Sent for production deployment.');
  await expect(page.locator('#approve-live')).toBeHidden();
  await page.getByRole('button', { name: 'Close live publication review' }).click();
  await page.getByRole('button', { name: 'View content', exact: true }).click();
  await expect(page.locator('#editor-heading')).toHaveText('Published article');
  await expect(page.locator('#draft-title')).toHaveAttribute('readonly', '');
  await expect(page.locator('#save-draft')).toBeDisabled();
  await page.getByRole('button', { name: 'Close draft editor' }).click();
  await page.getByLabel('Content type').selectOption('all');
  await page.getByRole('button', { name: 'Drafts 1', exact: true }).click();
  await page.getByRole('button', { name: 'Review & edit' }).click();
  await page.getByLabel('I’ve reviewed the code, sources, and browser-support claims.').check();
  await page.getByRole('button', { name: 'Add to local site', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Published 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#draft-count')).toHaveText('0');
  await expect(page.locator('#board h3')).toHaveText(['A draft CSS tip', 'Published CSS tip', 'Published article']);
  await page.reload();
  await expect(page.locator('#draft-count')).toHaveText('0');
  await expect(page.locator('#published-count')).toHaveText('3');
  await page.getByRole('button', { name: 'Drafts 0', exact: true }).click();
  await expect(page.locator('#board .draft-card')).toHaveCount(0);
  await expect(page.locator('#board')).toContainText('A little room for your next draft.');
  await page.getByRole('button', { name: 'Published 3', exact: true }).click();
  await page.getByLabel('Content type').selectOption('quick-win');
  await expect(page.locator('#board h3')).toHaveText(['A draft CSS tip', 'Published CSS tip']);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

testStudio('a failed publication stays in Drafts and does not inflate Published', async ({ page, studio }) => {
  studio.failPublication();
  await page.goto(studio.url);
  await page.getByRole('button', { name: 'Drafts 1', exact: true }).click();
  await page.getByRole('button', { name: 'Review & edit' }).click();
  await page.getByLabel('I’ve reviewed the code, sources, and browser-support claims.').check();
  await page.getByRole('button', { name: 'Add to local site', exact: true }).click();
  await expect(page.locator('#message')).toHaveText('Publication failed for this test.');
  await expect(page.getByRole('button', { name: 'Drafts 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#published-count')).toHaveText('2');
  await expect(page.locator('#board h3')).toHaveText(['A draft CSS tip']);
});


testStudio('homepage dashboard edits, pins and persists the curated rotation', async ({ page, studio }) => {
  await page.goto(studio.url);
  const panel = page.locator('.homepage-panel');
  await expect(panel.getByRole('heading', { name: 'A Closer Look', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Edit copy & settings', exact: true }).click();
  await expect(page.locator('#homepage-form')).toBeVisible();
  await page.locator('#homepage-edit-topic').selectOption('fluid-type');
  await page.getByText('Advanced rotation settings', {exact:true}).click();
  await page.locator('#homepage-mode').selectOption('manual');
  await page.locator('#homepage-pinned').selectOption('fluid-type');
  await page.locator('#home-fluid-type-headline').fill('Type with a little more room.');
  await panel.getByRole('button', { name: 'Save & rebuild preview' }).click();
  await expect(page.locator('#homepage-status')).toContainText('Saved and local preview rebuilt');
  await expect(page.locator('#homepage-status')).toContainText('Fluid typography');
  await page.reload();
  await panel.getByRole('button', { name: 'Edit copy & settings', exact: true }).click();
  await page.locator('#homepage-edit-topic').selectOption('fluid-type');
  await expect(page.locator('#homepage-mode')).toHaveValue('manual');
  await expect(page.locator('#home-fluid-type-headline')).toHaveValue('Type with a little more room.');
  await expect(page.locator('#homepage-upcoming li')).toHaveCount(6);
});


testStudio('homepage notebook covers the article collection, filters and reflows accessibly', async ({ page, studio }, testInfo) => {
  await page.goto(studio.url);
  const panel = page.locator('.homepage-panel');
  await expect(page.locator('#homepage-ready-count')).toContainText('18 working demos');
  await expect(page.locator('#homepage-form')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  await panel.screenshot({ path: testInfo.outputPath('homepage-overview.png') });
  await panel.getByRole('button', { name: /Article demos/ }).click();
  const articles = (await loadContent()).filter(entry => entry.type === 'article');
  await expect(page.locator('.homepage-proposal')).toHaveCount(articles.length - 1);
  await page.locator('#homepage-idea-state').selectOption('all');
  await expect(page.locator('.homepage-proposal')).toHaveCount(articles.length);
  await page.getByRole('searchbox', { name: 'Find an article or demo' }).fill('text-margin-trim');
  await expect(page.locator('.homepage-proposal')).toHaveCount(1);
  await page.locator('.homepage-proposal summary').press('Enter');
  await expect(page.locator('.homepage-proposal-body')).toContainText('text-box-trim');
  await page.setViewportSize({ width: 320, height: 900 });
  const box = await panel.boundingBox();
  expect(box.width).toBeLessThanOrEqual(320);
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).include('.homepage-panel').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});


testStudio('compact homepage switcher persists demo history and excludes demonstrated ideas', async ({ page, studio }) => {
  await page.goto(studio.url);
  const panel = page.locator('.homepage-panel');
  await expect(page.locator('#homepage-quick-demo')).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await panel.boundingBox()).height).toBeLessThan(570);
  await page.locator('#homepage-quick-demo').selectOption('aspect-ratio');
  await page.getByRole('button', { name: 'Use demo', exact: true }).click();
  await expect(page.locator('#homepage-current-topic')).toHaveText('Aspect ratio');
  await expect(page.locator('#homepage-status')).toContainText('History saved');
  await page.reload();
  await expect(page.locator('#homepage-quick-demo')).toHaveValue('aspect-ratio');
  await expect(page.locator('#homepage-quick-demo option[value="container-queries"]')).toContainText('demonstrated');
  await panel.getByRole('button', { name: /Article demos/ }).click();
  await page.locator('#homepage-idea-search').fill('subgrid');
  await page.locator('.homepage-proposal summary').click();
  await page.getByRole('button', { name: 'Mark demonstrated', exact: true }).click();
  await expect(page.locator('#homepage-status')).toContainText('Marked demonstrated');
  await expect(page.locator('.homepage-proposal')).toHaveCount(0);
  await page.locator('#homepage-idea-state').selectOption('demonstrated');
  await expect(page.locator('.homepage-proposal-state')).toHaveText('Demonstrated');
  await page.reload();
  await panel.getByRole('button', { name: /Article demos/ }).click();
  await page.locator('#homepage-idea-search').fill('subgrid');
  await expect(page.locator('.homepage-proposal')).toHaveCount(0);
});


testStudio('month-by-month scheduling fills unused articles once and persists clear month choices', async ({ page, studio }, testInfo) => {
  await page.goto(studio.url);
  const panel = page.locator('.homepage-panel');
  await expect(page.locator('#homepage-quick-demo')).toBeEnabled();
  await panel.getByRole('button', { name: 'Schedule demos', exact: true }).click();
  await expect(page.locator('[data-home-month]')).toHaveCount(18);
  await page.getByRole('button', { name: 'Fill unused articles', exact: true }).click();
  const selected = await page.locator('[data-home-month]').evaluateAll(fields => fields.map(field=>field.value).filter(Boolean));
  expect(selected.length).toBe(15);
  expect(new Set(selected).size).toBe(15);
  await panel.screenshot({path:testInfo.outputPath('article-schedule.png')});
  expect(selected).not.toContain('container-queries');
  expect(selected).not.toContain('fluid-type');
  await page.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await expect(page.locator('#homepage-schedule-status')).toContainText('Schedule saved');
  await page.reload();
  await panel.getByRole('button', { name: 'Schedule demos', exact: true }).click();
  expect(await page.locator('[data-home-month]').evaluateAll(fields=>fields.map(field=>field.value).filter(Boolean))).toEqual(selected);
});

testStudio('article previews open the executable demo without changing the saved selection', async ({ page, studio }) => {
  await page.goto(studio.url);
  const panel = page.locator('.homepage-panel');
  await expect(page.locator('#homepage-quick-demo')).toHaveValue('container-queries');
  await panel.getByRole('button', { name: /Article demos/ }).click();
  await page.locator('.homepage-proposal summary').first().click();
  const opened = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Preview demo', exact:true }).first().click();
  const preview = await opened;
  await expect(preview.locator('.article-demo')).toBeVisible();
  await expect(preview.locator('.css-in-action-code pre')).toContainText('container-type: scroll-state');
  await expect(preview.getByRole('link',{name:'Read the full breakdown'})).toHaveAttribute('href','/articles/scroll-state/');
  await preview.close();
  await page.reload();
  await expect(page.locator('#homepage-quick-demo')).toHaveValue('container-queries');
});

testStudio('dense research history groups unique sources and contains every expanded link', async ({ page, studio }, testInfo) => {
  const hosts=['developer.mozilla.org','ishadeed.com','web.dev'];
  const sources=Array.from({length:45},(_,index)=>({title:index===0?'A very long source title '+ 'reference'.repeat(24):`CSS layout reference ${index+1}`,url:`https://${hosts[index%3]}/guides/layout-${index+1}`}));
  const scanId=randomUUID();
  await page.route('**/admin/api/state',async route=>{
    const response=await route.fetch();const data=await response.json();
    data.scans=[{id:scanId,createdAt:'2026-11-18T12:00:00Z',ideas:[],focus:'Responsive components and conditional border radius',days:30,sourceIds:['mdn','ahmad','webdev','kevin'],sources:[...sources,sources[0],sources[0]]}];
    await route.fulfill({response,json:data});
  });
  for(const width of [1440,1050,780,390]) {
    await page.setViewportSize({width,height:1000});await page.goto(studio.url);
    await page.locator('#scan-history > summary').click();
    const entry=page.locator('.history-entry');
    await expect(entry.locator('.history-coverage .coverage-missing')).toContainText('Kevin Powell');
    const summary=entry.getByText('View 45 sources across 3 sites',{exact:true});
    await expect(summary).toBeVisible();
    await expect(entry.locator('.history-source-groups')).toBeHidden();
    await summary.focus();await page.keyboard.press('Enter');
    await expect(entry.locator('.history-source-group')).toHaveCount(3);
    await expect(entry.locator('.history-source-group a')).toHaveCount(45);
    expect(new Set(await entry.locator('a').evaluateAll(links=>links.map(link=>link.href))).size).toBe(45);
    expect(await entry.evaluate(element=>element.scrollWidth <= element.clientWidth+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    if(width===1440 || width===390) await entry.screenshot({path:testInfo.outputPath(`research-history-${width}.png`)});
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    const box=await entry.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth,children:[...element.querySelectorAll('*')].filter(child=>child.getBoundingClientRect().right>element.getBoundingClientRect().right+1).map(child=>child.className||child.tagName)}));
    expect(box.scroll <= box.width+1,`${width}: ${JSON.stringify(box)}`).toBe(true);
  }
});

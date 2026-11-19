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
    await writeFile(join(root, 'content/homepage-feature.json'), await readFile('content/homepage-feature.json'));
    await symlink(join(process.cwd(), 'dist'), join(root, 'dist'));
    await writeFile(join(root, '.tcl-admin/state.json'), JSON.stringify({ version: 1, scans: [],
      drafts: [draft, article, quickWin], releases: [{ id: randomUUID(), draftId: article.id, status: 'submitted',
        title: article.title, type: article.type, slug: article.slug, commit: 'a'.repeat(40),
        createdAt: article.publishedAt, submittedAt: article.publishedAt, checks: 'Passed',
        config: { repository: 'test/lounge', branch: 'main' }, files: [], diff: '', pushed: [] }] }));
    let failPublication = false;
    const server = await createAdminServer({ root, homepageBuilder: async () => {}, apiKey: 'test-only', inventoryLoader: async () => [],
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
  await expect(page.locator('#homepage-form')).toBeVisible();
  await page.locator('#homepage-mode').selectOption('manual');
  await page.locator('#homepage-pinned').selectOption('fluid-type');
  await page.locator('#home-fluid-type-headline').fill('Type with a little more room.');
  await panel.getByRole('button', { name: 'Save & rebuild preview' }).click();
  await expect(page.locator('#homepage-status')).toContainText('Saved and local preview rebuilt');
  await expect(page.locator('#homepage-status')).toContainText('Fluid typography');
  await page.reload();
  await expect(page.locator('#homepage-mode')).toHaveValue('manual');
  await expect(page.locator('#home-fluid-type-headline')).toHaveValue('Type with a little more room.');
  await expect(page.locator('#homepage-upcoming li')).toHaveCount(6);
});

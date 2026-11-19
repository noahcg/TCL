import { parseFragment } from 'parse5';
import { nodeText } from '../../src/build/content.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFeature, selection, validateFeature, featureDashboard } from '../../src/build/homepage-feature.mjs';
import { cssInAction } from '../../src/build/css-in-action.mjs';
const config = { ...await readFeature(), mode: 'monthly', startMonth: '2026-11', pinned: 'container-queries', queue: ['container-queries','fluid-type','aspect-ratio'], schedule: {}, usedDemos: ['container-queries'], usedArticles: ['container-query-units'] };
test('monthly rotation is deterministic and holds the final demo without replay', () => {
  assert.equal(selection(config, new Date('2026-11-01Z')).id, 'container-queries');
  assert.equal(selection(config, new Date('2026-12-01Z')).id, 'fluid-type');
  assert.equal(selection(config, new Date('2027-01-01Z')).id, 'aspect-ratio');
  assert.equal(selection(config, new Date('2027-02-01Z')).id, 'aspect-ratio');
  assert.equal(selection({ ...config, mode: 'manual', pinned: 'aspect-ratio' }, new Date('2027-02-01Z')).id, 'aspect-ratio');
  assert.equal(featureDashboard(config).upcoming.length, 6);
});
test('invalid or empty queues and unsupported demo code cannot enter configuration', () => {
  assert.throws(() => validateFeature({ ...config, queue: [] }));
  assert.throws(() => validateFeature({ ...config, queue: ['unknown'] }));
  assert.throws(() => validateFeature({ ...config, startMonth: '2027-13' }));
});
test('each topic renders its matching real CSS and escapes editorial text', () => {
  for (const id of config.queue) {
    const html = cssInAction([], { config: { ...config, mode: 'manual', pinned: id } });
    assert.ok(html.includes(`data-technique="${id}"`));
    if (id === 'fluid-type') assert.ok(nodeText(parseFragment(html)).includes('7cqi'));
    if (id === 'aspect-ratio') assert.ok(nodeText(parseFragment(html)).includes('16 / 9'));
  }
  const changed = structuredClone(config);
  changed.features['container-queries'].headline = '<script>alert(1)</script>';
  assert.ok(cssInAction([], { config: changed, date: new Date('2026-11-01Z') }).includes('&lt;script&gt;'));
});

test('every published article has a distinct, actionable demo proposal and a real route', async () => {
  const { loadContent } = await import('../../src/build/content.mjs');
  const { articleDemoProposals } = await import('../../src/build/homepage-feature.mjs');
  const inventory = await loadContent();
  const articles = inventory.filter(entry => entry.type === 'article');
  const proposals = await articleDemoProposals(inventory);
  assert.equal(proposals.length, articles.length);
  assert.equal(new Set(proposals.map(item => item.title)).size, articles.length);
  for (const proposal of proposals) {
    assert.equal(proposal.status, 'ready', proposal.articleTitle);
    assert.ok(proposal.demoId);
    for (const key of ['interaction','result','fallback']) assert.ok(proposal[key].length > 30);
    assert.ok(articles.some(article => article.path === proposal.articlePath));
  }
});


test('demonstrated article ideas stay flagged independently of their proposal title', async () => {
  const { loadContent } = await import('../../src/build/content.mjs');
  const { articleDemoProposals, demonstratedDemos } = await import('../../src/build/homepage-feature.mjs');
  const settings = { ...config, mode: 'manual', usedArticles: ['subgrid'], usedDemos: ['container-queries'] };
  const proposals = await articleDemoProposals(await loadContent(), settings);
  assert.equal(proposals.find(item => item.articleSlug === 'subgrid').status, 'demonstrated');
  assert.equal(proposals.find(item => item.articleSlug === 'specificity').status, 'ready');
  assert.ok(demonstratedDemos(config, new Date('2027-03-01Z')).includes('aspect-ratio'));
});

test('every published article has an executable demo and schedules reject repetitions', async () => {
  const { loadContent } = await import('../../src/build/content.mjs');
  const { demoArticles } = await import('../../src/build/homepage-feature.mjs');
  for (const article of (await loadContent()).filter(item=>item.type==='article')) assert.ok(Object.entries(demoArticles).some(([id,slug])=>slug===article.slug && config.features[id]), article.title);
  assert.throws(()=>validateFeature({...config,schedule:{'2027-01':'subgrid','2027-02':'subgrid'}}), /only be scheduled once/);
  const scheduled = {...config,mode:'monthly',schedule:{'2026-12':'subgrid','2027-01':'color-mix'}};
  assert.equal(selection(scheduled,new Date('2026-12-20Z')).id,'subgrid');
  assert.equal(selection(scheduled,new Date('2027-03-01Z')).id,'color-mix');
});

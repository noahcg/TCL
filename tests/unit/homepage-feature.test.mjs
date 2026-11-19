import { parseFragment } from 'parse5';
import { nodeText } from '../../src/build/content.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFeature, selection, validateFeature, featureDashboard } from '../../src/build/homepage-feature.mjs';
import { cssInAction } from '../../src/build/css-in-action.mjs';
const config = await readFeature();
test('monthly rotation is deterministic across years and repeats the curated queue', () => {
  assert.equal(selection(config, new Date('2026-11-01Z')).id, 'container-queries');
  assert.equal(selection(config, new Date('2026-12-01Z')).id, 'fluid-type');
  assert.equal(selection(config, new Date('2027-01-01Z')).id, 'aspect-ratio');
  assert.equal(selection(config, new Date('2027-02-01Z')).id, 'container-queries');
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

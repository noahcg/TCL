import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { loadContent, nodeText, walk } from '../../src/build/content.mjs';
import { quickPage } from '../../src/build/pages.mjs';

test('Quick Wins cards preserve every original snippet and distinct detail link', async () => {
  const entries = (await loadContent()).filter(entry => entry.type === 'quick-win');
  const html = quickPage(entries);
  const nodes = walk(parseFragment(html));
  const snippets = nodes.filter(node => node.tagName === 'pre').map(nodeText);
  assert.deepEqual(snippets, entries.map(entry => entry.code));
  for (const entry of entries) assert.ok(html.includes(`href="${entry.path}"`), entry.slug);
  const ids = nodes.flatMap(node => (node.attrs || []).filter(attr => attr.name === 'id').map(attr => attr.value));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(nodes.filter(node => node.tagName === 'h1').map(nodeText).join('').replace('✳', ''), 'Quick Wins');
});

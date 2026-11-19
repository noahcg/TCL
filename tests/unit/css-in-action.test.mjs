import test from 'node:test';
import assert from 'node:assert/strict';
import { readFeature } from '../../src/build/homepage-feature.mjs';
import { cssInAction } from '../../src/build/css-in-action.mjs';

const config = await readFeature();
config.mode = 'manual';
config.pinned = 'container-queries';
const render = entries => cssInAction(entries, { config });

test('A Closer Look only links to its relevant published article using the resolved content route', () => {
  assert.doesNotMatch(render([]), /Read the full breakdown/);
  assert.doesNotMatch(render([{ type: 'resource', slug: 'container-query-units', path: '/resources/example/' }]), /Read the full breakdown/);
  const html = render([{ type: 'article', slug: 'container-query-units', path: '/articles/resolved-route/' }]);
  assert.match(html, /href="\/articles\/resolved-route\/">Read the full breakdown/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cssInAction } from '../../src/build/css-in-action.mjs';

test('A Closer Look only links to its relevant published article using the resolved content route', () => {
  assert.doesNotMatch(cssInAction([]), /Read the full breakdown/);
  assert.doesNotMatch(cssInAction([{ type: 'resource', slug: 'container-query-units', path: '/resources/example/' }]), /Read the full breakdown/);
  const html = cssInAction([{ type: 'article', slug: 'container-query-units', path: '/articles/resolved-route/' }]);
  assert.match(html, /href="\/articles\/resolved-route\/">Read the full breakdown/);
});

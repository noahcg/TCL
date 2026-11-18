import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { walk } from '../../src/build/content.mjs';
import { page } from '../../src/build/pages.mjs';
import { loadHomeShareImage } from '../../src/build/site-media.mjs';

test('The homepage advertises a verified evergreen large-image social card', async () => {
  const image = await loadHomeShareImage();
  const html = page({ path: '/', homepage: true, body: '', siteUrl: 'https://lounge.example', image });
  const meta = new Map(walk(parse(html)).filter(node => node.tagName === 'meta').map(node => {
    const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
    return [attrs.property || attrs.name, attrs.content];
  }));
  assert.match(image.path, /^\/assets\/social\/home-[a-f0-9]{16}\.jpg$/);
  assert.equal(meta.get('og:image'), `https://lounge.example${image.path}`);
  assert.equal(meta.get('twitter:image'), meta.get('og:image'));
  assert.equal(meta.get('og:type'), 'website');
  assert.equal(meta.get('og:image:width'), '1200');
  assert.equal(meta.get('og:image:height'), '630');
  assert.equal(meta.get('og:image:type'), 'image/jpeg');
  assert.equal(meta.get('og:image:alt'), image.alt);
  assert.equal(meta.get('twitter:card'), 'summary_large_image');
});

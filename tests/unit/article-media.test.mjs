import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { loadContent, walk } from '../../src/build/content.mjs';
import { articlesPage, detail, page } from '../../src/build/pages.mjs';
import { featuredArticle, imageIsCurrent, imagePrompt, loadArticleImages, readMediaCatalog, validateArticleImage } from '../../src/build/article-media.mjs';

const articles = (await loadContent()).filter(entry => entry.type === 'article');
const catalog = await readMediaCatalog();

test('Every published article has distinct, current, correctly sized raster artwork', async () => {
  const images = await loadArticleImages(articles);
  assert.equal(images.size, articles.length);
  assert.equal(new Set([...images.values()].map(image => image.path)).size, articles.length);
  for (const image of images.values()) {
    assert.equal(image.width, 1200);
    assert.equal(image.height, 630);
    assert.equal(image.type, 'image/jpeg');
    assert.ok(image.alt.trim());
    assert.ok(image.generatedBy);
  }
});

test('Changing an article title invalidates its cached image instead of reusing unrelated art', async () => {
  const article = articles[0];
  const changed = { ...article, title: 'A new CSS topic' };
  assert.equal(imageIsCurrent(changed, catalog.images[article.slug]), false);
  await assert.rejects(validateArticleImage(changed, catalog.images[article.slug]), /missing or stale/);
  assert.ok(imagePrompt(changed).includes(changed.title));
});

test('Missing images and unsafe paths fail before publication', async () => {
  const article = articles[0];
  await assert.rejects(validateArticleImage(article), /missing or stale/);
  await assert.rejects(validateArticleImage(article, { ...catalog.images[article.slug], path: '/assets/../../private.jpg' }), /invalid public path/);
});

test('A featured article override uses that article’s artwork in the archive and hero', () => {
  const entry = { ...articles[0], featured: true, image: catalog.images[articles[0].slug] };
  const collection = [entry, ...articles.slice(1).map(article => ({ ...article, image: catalog.images[article.slug] }))];
  assert.equal(featuredArticle(collection).slug, entry.slug);
  assert.ok(articlesPage(collection).includes(`src="${entry.image.path}"`));
  assert.ok(detail(entry).includes(`class="article-cover" src="${entry.image.path}"`));
  assert.throws(() => featuredArticle([entry, { ...collection[1], featured: true }]), /Only one/);
});

test('The latest article is featured automatically regardless of collection order', () => {
  const older = { ...articles[0], slug: 'older', date: '2026-10-01', updatedAt: '2026-11-18T22:00:00Z', featured: false };
  const earlierToday = { ...older, slug: 'earlier-today', date: '2026-11-18', updatedAt: '2026-11-18T18:00:00Z' };
  const newest = { ...earlierToday, slug: 'newest', title: 'The newest CSS article', updatedAt: '2026-11-18T20:00:00Z',
    path: '/articles/newest/', image: catalog.images[articles[0].slug] };
  const collection = [earlierToday, older, newest];
  assert.equal(featuredArticle(collection), newest);
  const html = articlesPage(collection);
  assert.match(html, /id="archive-feature-title"><a href="\/articles\/newest\/">The newest CSS article<span class="archive-arrow"/);
  assert.deepEqual(collection, [earlierToday, older, newest]);
});

test('Article Open Graph and large-card metadata share the exact hero file with absolute URLs', () => {
  const article = { ...articles[0], image: catalog.images[articles[0].slug] };
  const html = page({ path: article.path, title: article.title, intro: article.summary, body: detail(article),
    siteUrl: 'https://lounge.example', image: article.image, article });
  const nodes = walk(parse(html));
  const meta = new Map(nodes.filter(node => node.tagName === 'meta').map(node => {
    const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
    return [attrs.property || attrs.name, attrs.content];
  }));
  const expected = `https://lounge.example${article.image.path}`;
  assert.equal(meta.get('og:image'), expected);
  assert.equal(meta.get('twitter:image'), expected);
  assert.equal(meta.get('og:image:width'), '1200');
  assert.equal(meta.get('og:image:height'), '630');
  assert.equal(meta.get('og:image:alt'), article.image.alt);
  assert.equal(meta.get('twitter:card'), 'summary_large_image');
  assert.equal(meta.get('og:type'), 'article');
  assert.ok(html.includes(`class="article-cover" src="${article.image.path}"`));
});

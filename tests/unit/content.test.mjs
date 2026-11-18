import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, snapshotFile, validateSnapshot } from '../../src/build/content.mjs';
import { detail } from '../../src/build/pages.mjs';

const snapshot = JSON.parse(await readFile(snapshotFile, 'utf8'));

test('Every published source entry has a distinct usable route', async () => {
  const records = await loadContent();
  assert.ok(records.length >= snapshot.articles.length + snapshot.quick.length + snapshot.resources.length);
  assert.equal(new Set(records.map(record => record.path)).size, records.length);
  for (const article of snapshot.articles) {
    const entry = records.find(record => record.path === `/articles/${article.slug}/`);
    assert.ok(entry, article.slug);
    assert.equal(entry.body, article.body);
    const output = detail(entry);
    assert.match(output, /<h1 id="article-title">/);
    for (const id of article.ids ?? []) assert.ok(output.includes(`id="${id}"`), id);
  }
});

test('A changed source body fails the snapshot integrity check', () => {
  const broken = structuredClone(snapshot);
  broken.articles[0].body = broken.articles[0].body.slice(0, -30);
  assert.throws(() => validateSnapshot(broken), /integrity/);
});

test('Equivalent captures can vary JSON field order without changing their integrity', () => {
  const equivalent = { ...snapshot, articles: snapshot.articles.map(row => Object.fromEntries(Object.entries(row).reverse())) };
  assert.equal(validateSnapshot(equivalent).seal, snapshot.integrity);
});

test('Article code block differences fail even in an unsealed input', () => {
  if (snapshot.method !== 'public-apex-rendered-dom') return;
  const { integrity, ...bundle } = structuredClone(snapshot);
  bundle.articles[0].code[0] += '\n';
  assert.throws(() => validateSnapshot(bundle, false), /code blocks differ/);
});

test('Raw source markup is kept intact while active attributes are removed', () => {
  if (snapshot.method !== 'public-apex-rendered-dom') return;
  const { integrity, ...bundle } = structuredClone(snapshot);
  const article = bundle.articles[0];
  article.body = '<p onclick="void(0)">Review</p><p><a href="javascript:void(0)">Reference</a></p>' + article.body;
  const result = validateSnapshot(bundle, false).records[0];
  assert.match(result.body, /onclick=/);
  assert.match(result.html, /<p>Review<\/p>/);
  assert.doesNotMatch(result.html, /onclick=|href="javascript:/);
});

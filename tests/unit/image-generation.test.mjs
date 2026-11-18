import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateArticleImage } from '../../src/build/image-generation.mjs';

const article = { slug: 'test-grid', type: 'article', title: 'Responsive layouts with CSS Grid', summary: 'A publishing test fixture.' };

test('The publishing provider sends the article prompt to the Images API and returns image bytes', async () => {
  let requests = 0;
  const bytes = await generateArticleImage(article, { apiKey: 'test-key', fetcher: async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.openai.com/v1/images/generations');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.ok(!options.body.includes('test-key'));
    const body = JSON.parse(options.body);
    assert.ok(body.prompt.includes(article.title));
    assert.equal(body.n, 1);
    return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('image-bytes').toString('base64') }] }) };
  } });
  assert.equal(requests, 1);
  assert.equal(bytes.toString(), 'image-bytes');
});

test('Missing credentials never make a request', async () => {
  await assert.rejects(generateArticleImage(article, { fetcher: () => assert.fail('Unexpected network request') }), /Missing OPENAI_API_KEY/);
});

test('Provider failures do not retry paid requests or leak the response body', async () => {
  let requests = 0;
  await assert.rejects(generateArticleImage(article, { apiKey: 'private-test-key', fetcher: async () => {
    requests++;
    return { ok: false, status: 429, json: () => assert.fail('Do not inspect or print provider errors') };
  } }), error => error.message.includes('HTTP 429') && !error.message.includes('private-test-key'));
  assert.equal(requests, 1);
});

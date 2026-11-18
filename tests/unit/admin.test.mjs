import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { consultedSources, generateDraft, requestAI, scanWeb } from '../../src/admin/ai.mjs';
import { draftRecord, readState, saveDraft, persistState } from '../../src/admin/store.mjs';
import { publishDraft } from '../../src/admin/publish.mjs';

const source = { url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing', title: 'field-sizing — MDN' };
const complete = (text, extra = []) => ({ status: 'completed', output: [...extra, { type: 'message', content: [{ type: 'output_text', text }] }] });
const idea = { id: randomUUID(), type: 'quick-win', title: 'Let a textarea find its own height', summary: 'Size a textarea to its content.',
  feature: 'field-sizing', rationale: 'A useful progressive enhancement.', compatibility: 'Check current browser support and keep a fallback.',
  tags: ['forms'], outline: ['Use case', 'CSS', 'Fallback'], sources: [source] };
const draft = () => ({ id: randomUUID(), ideaId: idea.id, type: 'quick-win', slug: 'a-roomy-textarea', title: 'A roomy textarea',
  summary: 'A textarea that grows.', body: '## Example\n\n```css\ntextarea { field-sizing: content; }\n```\n', code: 'textarea { field-sizing: content; }',
  note: 'Keep a minimum height.', difficulty: 'beginner', tags: ['forms'], sources: [source], savedAt: null });

test('Research sources accept only HTTPS evidence from selected domains', () => {
  const payload = complete('Research', [{ type: 'web_search_call', action: { sources: [source,
    { url: 'https://developer.mozilla.org.evil.test/x' }, { url: 'javascript:alert(1)' },
    { url: 'http://developer.mozilla.org/x' }, { url: 'https://developer.mozilla.org/x?token=secret' }] } }]);
  assert.deepEqual(consultedSources(payload, ['developer.mozilla.org']), [source]);
});

test('A scan requires live search, validates source links, and avoids repeated titles', async () => {
  const calls = [];
  const proposed = { ...idea, sourceUrls: [source.url, 'https://invented.example/post'] };
  const results = [complete('MDN research evidence', [{ type: 'web_search_call', action: { sources: [source] } }]),
    complete(JSON.stringify({ ideas: [proposed, proposed, { ...proposed, title: 'An existing title' }, { ...proposed, title: 'No evidence', sourceUrls: ['https://invented.example/post'] }] }))];
  const result = await scanWeb({ sourceIds: ['mdn'], days: 90, focus: 'forms', apiKey: 'test-private-key',
    inventory: [{ title: 'An existing title', type: 'article', tags: ['forms'], path: '/articles/existing/' }],
    fetcher: async (url, options) => { calls.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true, json: async () => results.shift() }; } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.tool_choice, 'required');
  assert.equal(calls[0].body.tools[0].external_web_access, true);
  assert.deepEqual(calls[0].body.tools[0].filters.allowed_domains, ['developer.mozilla.org']);
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[1].body.text.format.strict, true);
  assert.equal(result.ideas.length, 1);
  assert.deepEqual(result.ideas[0].sources, [source]);
  assert.equal(result.ideas[0].related[0].title, 'An existing title');
  assert.ok(!JSON.stringify(result).includes('test-private-key'));
});

test('API failures do not retry, expose provider bodies, or accept incomplete output', async () => {
  let calls = 0;
  await assert.rejects(requestAI('test', { apiKey: 'secret', fetcher: async () => {
    calls++; return { ok: false, status: 429, json: () => { throw new Error('Private provider body must not be read'); } };
  } }), /API limit/);
  assert.equal(calls, 1);
  await assert.rejects(requestAI('test', { fetcher: () => { throw new Error('Must not call'); } }), /OPENAI_API_KEY/);
  await assert.rejects(requestAI('test', { apiKey: 'secret', fetcher: async () => ({ ok: true, json: async () => ({ status: 'incomplete', output: [] }) }) }), /incomplete/);
  await assert.rejects(scanWeb({ sourceIds: ['arbitrary-domain'], apiKey: 'secret' }), /Choose at least/);
});

test('Generated Quick Wins include matching code and verified source credits', async () => {
  const generated = await generateDraft(idea, { apiKey: 'secret', fetcher: async () => ({ ok: true, json: async () => complete(JSON.stringify(draft())) }) });
  assert.ok(generated.body.includes('## Sources'));
  assert.ok(generated.body.includes(source.url));
  assert.ok(generated.body.includes(generated.code));
  assert.equal(draftRecord(generated).status, 'draft');
  await assert.rejects(generateDraft(idea, { apiKey: 'secret', fetcher: async () => ({ ok: true, json: async () => complete(JSON.stringify({ ...draft(), body: 'No CSS example.' })) }) }), /CSS snippet/);
});

test('Draft persistence survives restart and protects existing and published content', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tcl-admin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = draft();
  const saved = await saveDraft(root, original, []);
  const file = join(root, 'content/authored', saved.savedFile);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'draft');
  const state = { version: 1, scans: [], drafts: [saved] };
  await persistState(root, state);
  assert.deepEqual(await readState(root), state);
  await assert.rejects(saveDraft(root, { ...original, id: randomUUID() }, []), /already uses/);
  await assert.rejects(saveDraft(root, { ...saved, slug: 'changed-url' }, []), /stable/);
  await assert.rejects(saveDraft(root, { ...draft(), slug: 'another-title' }, [{ type: 'quick-win', slug: 'another-title' }]), /already used/);
  await assert.rejects(saveDraft(root, { ...original, slug: '../../escape' }, []), /URL slug/);
  const content = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...content, status: 'published' }));
  await assert.rejects(saveDraft(root, saved, []), /published or changed/);
});

test('The static output cannot contain studio files, research history, or the session token', async () => {
  const build = await readFile(new URL('../../scripts/build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('src/admin'));
  const { readdir } = await import('node:fs/promises');
  const assets = await readdir(new URL('../../src/assets/', import.meta.url));
  assert.ok(!assets.some(file => /admin|studio/.test(file)));
});

test('Local publishing builds published content and restores a draft after a failed build', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tcl-publish-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const saved = await saveDraft(root, draft(), []);
  const file = join(root, 'content/authored', saved.savedFile);
  let builds = 0;
  await assert.rejects(publishDraft(saved, { root, build: async () => {
    builds++;
    const record = JSON.parse(await readFile(file, 'utf8'));
    if (builds === 1) { assert.equal(record.status, 'published'); throw new Error('Build failure'); }
    assert.equal(record.status, 'draft');
  }, prepareArtwork: () => assert.fail('Quick Wins do not need artwork') }), /restored to draft/);
  assert.equal(builds, 2);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'draft');
  await publishDraft(saved, { root, build: async () => { assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'published'); } });
  assert.match(JSON.parse(await readFile(file, 'utf8')).date, /^\d{4}-\d{2}-\d{2}$/);
  await assert.rejects(publishDraft(saved, { root, build: async () => {} }), /content file changed/);
});

test('Artwork failure leaves the article as a draft and never starts a build', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tcl-artwork-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const saved = await saveDraft(root, { ...draft(), type: 'article' }, []);
  await assert.rejects(publishDraft(saved, { root, prepareArtwork: async () => { throw new Error('Artwork unavailable'); }, build: () => assert.fail('Must not build') }), /Artwork unavailable/);
  assert.equal(JSON.parse(await readFile(join(root, 'content/authored', saved.savedFile), 'utf8')).status, 'draft');
});

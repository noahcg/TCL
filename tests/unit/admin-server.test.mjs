import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createAdminServer } from '../../src/admin/server.mjs';

test('The private server protects its API and completes scan, draft, save and publish jobs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tcl-studio-'));
  const idea = { id: randomUUID(), type: 'quick-win', title: 'Local test idea', status: 'new' };
  const draft = { id: randomUUID(), ideaId: idea.id, type: 'quick-win', slug: 'local-test-idea', title: idea.title,
    summary: 'A test draft.', body: '```css\np { color: green; }\n```', code: 'p { color: green; }', note: '', difficulty: 'beginner', tags: [],
    sources: [{ url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/color', title: 'MDN' }] };
  let published = false;
  let liveSubmitted = false;
  const release = { id: randomUUID(), draftId: draft.id, title: draft.title, type: draft.type, slug: draft.slug,
    commit: 'a'.repeat(40), status: 'ready', files: [], diff: '', checks: 'Passed', pushed: [],
    config: { repository: 'test/lounge', branch: 'main', siteUrl: null }, snapshot: { private: 'internal-only' }, index: 'internal-only' };
  const server = await createAdminServer({ root, apiKey: 'never-echo-this-key', inventoryLoader: async () => [],
    scanner: async () => ({ id: randomUUID(), ideas: [idea] }), generator: async () => draft,
    publisher: async value => { assert.equal(value.id, draft.id); published = true; },
    livePreparer: async value => { assert.equal(value.id, draft.id); return release; },
    liveSubmitter: async (value, { onChange }) => { liveSubmitted = true; value.status = 'submitted'; await onChange(); } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const htmlResponse = await fetch(`${origin}/admin/`);
  assert.match(htmlResponse.headers.get('x-robots-tag'), /noindex/);
  const html = await htmlResponse.text();
  const token = /name="studio-session" content="([a-f0-9]+)"/.exec(html)[1];
  const call = async (route, body, extra = {}) => {
    const response = await fetch(`${origin}/admin/api/${route}`, { method: body ? 'POST' : 'GET',
      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json', ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const rawStatus = headers => new Promise((resolve, reject) => {
    const request = httpRequest(`${origin}/admin/api/state`, { headers: { 'X-Admin-Token': token, ...headers } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    request.on('error', reject); request.end();
  });
  assert.equal((await fetch(`${origin}/admin/api/state`)).status, 403);
  assert.equal((await call('scan', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal(await rawStatus({ Host: 'evil.example' }), 403);
  assert.equal(await rawStatus({ 'Sec-Fetch-Site': 'cross-site' }), 403);
  assert.equal((await fetch(`${origin}/admin/ai.mjs`)).status, 404);
  assert.equal((await fetch(`${origin}/.env.local`)).status, 404);
  assert.equal((await call('state')).data.configured, true);
  assert.ok(!JSON.stringify((await call('state')).data).includes('never-echo-this-key'));
  const finishJob = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await call('state');
      if (result.data.job.status !== 'running') { assert.equal(result.data.job.status, 'complete', result.data.job.error); return result.data; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Job did not finish');
  };
  assert.equal((await call('scan', { sourceIds: ['mdn'], days: 90 })).status, 202);
  assert.equal((await finishJob()).scans.length, 1);
  assert.equal((await call('generate', { id: idea.id })).status, 202);
  assert.equal((await finishJob()).drafts.length, 1);
  assert.equal((await call('generate', { id: idea.id })).status, 200);
  const saved = await call('save', { id: draft.id });
  assert.equal(saved.status, 200);
  assert.equal(JSON.parse(await readFile(join(root, saved.data.file), 'utf8')).status, 'draft');
  assert.equal((await call('preview', { id: draft.id })).status, 200);
  assert.equal((await call('publish', { id: draft.id })).status, 202);
  assert.ok((await finishJob()).drafts[0].publishedAt);
  assert.equal(published, true);
  assert.equal((await call('save', { id: draft.id })).status, 400);
  assert.equal((await call('prepare-live', { id: draft.id })).status, 202);
  const prepared = await finishJob();
  assert.equal(prepared.releases[0].status, 'ready');
  assert.equal(prepared.releases[0].snapshot, undefined);
  assert.equal(prepared.releases[0].index, undefined);
  assert.equal(liveSubmitted, false);
  assert.equal((await call('deploy-live', { id: release.id })).status, 400);
  assert.equal((await call('deploy-live', { id: release.id, approved: false })).status, 400);
  assert.equal(liveSubmitted, false);
  assert.equal((await call('deploy-live', { id: release.id, approved: true })).status, 202);
  assert.equal((await finishJob()).releases[0].status, 'submitted');
  assert.equal(liveSubmitted, true);
});

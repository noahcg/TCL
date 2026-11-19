import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { findRunningStudio, startAdminService } from '../../src/admin/runtime.mjs';

async function workspace(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'tcl-desktop-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Desktop and CLI reuse one studio without overwriting history or stopping the owner', async t => {
  const root = await workspace(t);
  const history = { version: 1, scans: [{ id: randomUUID(), ideas: [] }], drafts: [], releases: [] };
  await mkdir(join(root, '.tcl-admin'));
  await writeFile(join(root, '.tcl-admin/state.json'), JSON.stringify(history));
  const original = await readFile(join(root, '.tcl-admin/state.json'), 'utf8');
  const service = await startAdminService({ root, port: 0, inventoryLoader: async () => [] });
  t.after(() => service.close());
  const running = await findRunningStudio(root);
  assert.equal(running.url, service.url);
  assert.equal(running.owned, false);
  const reused = await startAdminService({ root, port: 0 });
  assert.equal(reused.url, service.url);
  assert.equal(reused.owned, false);
  await reused.close();
  const health = await fetch(new URL('health', service.url)).then(response => response.json());
  assert.equal(health.pid, process.pid);
  assert.equal(health.workspace, root);
  assert.equal(await readFile(join(root, '.tcl-admin/state.json'), 'utf8'), original);
  await service.close();
  await assert.rejects(readFile(join(root, '.tcl-admin/server.lock')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(root, '.tcl-admin/server.json')), { code: 'ENOENT' });
});

test('A stale lock is recovered, while a live unverified process is left alone', async t => {
  const root = await workspace(t);
  await mkdir(join(root, '.tcl-admin'));
  await writeFile(join(root, '.tcl-admin/server.lock'), '2147483647');
  const service = await startAdminService({ root, port: 0, inventoryLoader: async () => [] });
  await service.close();
  await writeFile(join(root, '.tcl-admin/server.lock'), String(process.pid));
  await assert.rejects(startAdminService({ root, port: 0 }), /Another studio process/);
  assert.equal(await readFile(join(root, '.tcl-admin/server.lock'), 'utf8'), String(process.pid));
});

test('Quitting waits for an active research job to persist before releasing the workspace', async t => {
  const root = await workspace(t);
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const scan = { id: randomUUID(), ideas: [] };
  const service = await startAdminService({ root, port: 0, apiKey: 'test-key', inventoryLoader: async () => [],
    scanner: async () => { await pending; return scan; } });
  t.after(async () => { complete(); await service.close(); });
  const html = await fetch(service.url).then(response => response.text());
  const token = /name="studio-session" content="([a-f0-9]+)"/.exec(html)[1];
  const response = await fetch(new URL('api/scan', service.url), { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ sourceIds: ['mdn'], days: 30 }) });
  assert.equal(response.status, 202);
  await response.body.cancel();
  let closed = false;
  const closing = service.close().then(() => { closed = true; });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(closed, false);
  assert.equal(await readFile(join(root, '.tcl-admin/server.lock'), 'utf8'), String(process.pid));
  complete();
  await closing;
  const state = JSON.parse(await readFile(join(root, '.tcl-admin/state.json'), 'utf8'));
  assert.equal(state.scans[0].id, scan.id);
  await assert.rejects(readFile(join(root, '.tcl-admin/server.lock')), { code: 'ENOENT' });
});

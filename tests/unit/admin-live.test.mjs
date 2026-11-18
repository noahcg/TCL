import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { imageSourceHash } from '../../src/build/article-media.mjs';
import { prepareLiveRelease, submitLiveRelease, releaseSummary } from '../../src/admin/live.mjs';

const exec = promisify(execFile);
const git = async (root, ...args) => (await exec('git', args, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout.trim();
const digest = value => createHash('sha256').update(value).digest('hex');

async function fixture(t, type = 'quick-win') {
  const directory = await mkdtemp(join(tmpdir(), 'tcl-live-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'project');
  await mkdir(join(root, 'content/authored'), { recursive: true });
  await mkdir(join(root, 'content/media'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.tcl-admin/\nnode_modules/\ndist/\n');
  await writeFile(join(root, 'README.md'), 'Original README\n');
  await writeFile(join(root, 'other.txt'), 'Original file\n');
  await writeFile(join(root, 'content/media/article-images.json'), JSON.stringify({ version: 1, images: {} }, null, 2) + '\n');
  await git(root, 'init', '--initial-branch=main');
  await git(root, 'config', 'user.name', 'Studio Test');
  await git(root, 'config', 'user.email', 'studio@example.test');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'Initial site');
  const base = await git(root, 'rev-parse', 'HEAD');
  const remotes = [];
  for (const name of ['origin', 'vercel']) {
    const url = join(directory, `${name}.git`);
    await git(directory, 'init', '--bare', '--initial-branch=main', url);
    await git(root, 'remote', 'add', name, url);
    await git(root, 'push', name, 'main');
    remotes.push({ name, url, repository: `test/${name}` });
  }
  const draft = { id: randomUUID(), type, slug: 'an-approved-css-tip', savedFile: `${type}-an-approved-css-tip.json`,
    title: 'An approved CSS tip', summary: 'A useful CSS technique.', publishedAt: new Date().toISOString() };
  const record = { ...draft, adminDraftId: draft.id, status: 'published', format: 'markdown', body: '## Example\n\nA useful technique.', tags: ['css'] };
  await writeFile(join(root, 'content/authored', draft.savedFile), JSON.stringify(record, null, 2) + '\n');
  const configuration = { branch: 'main', remotes, productionRemote: 'vercel', repository: 'test/vercel', siteUrl: 'https://lounge.example' };
  return { directory, root, base, draft, record, configuration };
}

const remoteHead = (root, remote) => git(root, 'ls-remote', remote.url, 'refs/heads/main').then(value => value.split(/\s+/)[0]);

test('A reviewed release publishes only approved files and preserves unrelated working and staged edits', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'README.md'), 'An unrelated staged edit\n');
  await git(f.root, 'add', 'README.md');
  await writeFile(join(f.root, 'other.txt'), 'An unrelated working edit\n');
  await writeFile(join(f.root, 'content/authored/not-approved.json'), '{"status":"draft"}\n');
  let verified = false;
  const release = await prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async checkout => {
    verified = true;
    assert.equal(JSON.parse(await readFile(join(checkout, 'content/authored', f.draft.savedFile), 'utf8')).title, f.draft.title);
    await assert.rejects(readFile(join(checkout, 'content/authored/not-approved.json')));
    assert.equal(await readFile(join(checkout, 'README.md'), 'utf8'), 'Original README\n');
  } });
  assert.equal(verified, true);
  assert.equal(release.status, 'ready');
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
  assert.equal(await remoteHead(f.root, f.configuration.remotes[1]), f.base);
  assert.deepEqual(release.files.map(file => file.path), [`content/authored/${f.draft.savedFile}`]);
  assert.ok(release.diff.includes(f.draft.title));
  const summary = releaseSummary(release);
  assert.equal(summary.config, undefined);
  assert.equal(summary.index, undefined);
  assert.equal(summary.liveUrl, 'https://lounge.example/quick-wins/an-approved-css-tip/');
  await submitLiveRelease(release, { root: f.root });
  assert.equal(release.status, 'submitted');
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), release.commit);
  for (const remote of f.configuration.remotes) assert.equal(await remoteHead(f.root, remote), release.commit);
  assert.equal(await git(f.root, 'diff', '--cached', '--name-only'), 'README.md');
  assert.equal(await readFile(join(f.root, 'other.txt'), 'utf8'), 'An unrelated working edit\n');
  const tree = await git(f.root, 'ls-tree', '-r', '--name-only', 'HEAD');
  assert.ok(!tree.includes('.tcl-admin') && !tree.includes('not-approved'));
  await assert.rejects(submitLiveRelease(release, { root: f.root }), /already been submitted/);
});

test('Content changed after approval preparation is rejected before a commit or push', async t => {
  const f = await fixture(t);
  const release = await prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async () => {} });
  await writeFile(join(f.root, 'content/authored', f.draft.savedFile), JSON.stringify({ ...f.record, title: 'Changed after review' }));
  await assert.rejects(submitLiveRelease(release, { root: f.root }), /changed after review/);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
  for (const remote of f.configuration.remotes) assert.equal(await remoteHead(f.root, remote), f.base);
});

test('A partial upload can be retried without a duplicate commit or force push', async t => {
  const f = await fixture(t);
  const release = await prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async () => {} });
  const hook = join(f.configuration.remotes[1].url, 'hooks/pre-receive');
  await writeFile(hook, '#!/bin/sh\nexit 1\n'); await chmod(hook, 0o700);
  await assert.rejects(submitLiveRelease(release, { root: f.root }), /Push to vercel did not complete/);
  assert.equal(release.status, 'failed');
  assert.deepEqual(release.pushed, ['origin']);
  assert.equal(await remoteHead(f.root, f.configuration.remotes[0]), release.commit);
  assert.equal(await remoteHead(f.root, f.configuration.remotes[1]), f.base);
  await rm(hook);
  await submitLiveRelease(release, { root: f.root });
  assert.equal(release.status, 'submitted');
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), release.commit);
  assert.equal(await git(f.root, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal(await remoteHead(f.root, f.configuration.remotes[1]), release.commit);
});

test('New remote commits block the prepared publication without replacing remote history', async t => {
  const f = await fixture(t);
  const release = await prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async () => {} });
  const other = join(f.directory, 'other-checkout');
  await git(f.directory, 'clone', f.configuration.remotes[1].url, other);
  await git(other, 'config', 'user.name', 'Other Editor'); await git(other, 'config', 'user.email', 'other@example.test');
  await writeFile(join(other, 'README.md'), 'A newer remote edit\n');
  await git(other, 'add', 'README.md'); await git(other, 'commit', '-m', 'Newer edit'); await git(other, 'push', 'origin', 'main');
  const changed = await remoteHead(f.root, f.configuration.remotes[1]);
  await assert.rejects(submitLiveRelease(release, { root: f.root }), /changed since review/);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
  assert.equal(await remoteHead(f.root, f.configuration.remotes[1]), changed);
});

test('An article release includes only its own image and catalog entry', async t => {
  const f = await fixture(t, 'article');
  const bytes = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#203b2d' } }).jpeg().toBuffer();
  const checksum = digest(bytes);
  const path = `/assets/articles/${f.draft.slug}-${checksum.slice(0, 16)}.jpg`;
  const image = { title: f.record.title, sourceHash: imageSourceHash(f.record), path, sha256: checksum,
    width: 1200, height: 630, type: 'image/jpeg', alt: 'An original CSS concept image.' };
  await mkdir(join(f.root, 'src/assets/articles'), { recursive: true });
  await writeFile(join(f.root, `src${path}`), bytes);
  const catalog = { version: 1, images: { [f.draft.slug]: image, 'another-pending-article': { title: 'Do not publish this yet' } } };
  await writeFile(join(f.root, 'content/media/article-images.json'), JSON.stringify(catalog, null, 2) + '\n');
  const release = await prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async checkout => {
    const prepared = JSON.parse(await readFile(join(checkout, 'content/media/article-images.json'), 'utf8'));
    assert.deepEqual(Object.keys(prepared.images), [f.draft.slug]);
    assert.equal(digest(await readFile(join(checkout, `src${path}`))), checksum);
  } });
  assert.equal(release.files.length, 3);
  await submitLiveRelease(release, { root: f.root });
  const committed = JSON.parse(await git(f.root, 'show', 'HEAD:content/media/article-images.json'));
  assert.deepEqual(Object.keys(committed.images), [f.draft.slug]);
  assert.ok((await git(f.root, 'diff', '--', 'content/media/article-images.json')).includes('another-pending-article'));
  assert.equal(await git(f.root, 'diff', '--cached', '--name-only'), '');
});

test('Failed checks and staged release files never produce a publishable release', async t => {
  const f = await fixture(t);
  await assert.rejects(prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration,
    verify: async () => { throw new Error('Checks failed'); } }), /Checks failed/);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
  for (const remote of f.configuration.remotes) assert.equal(await remoteHead(f.root, remote), f.base);
  await git(f.root, 'add', `content/authored/${f.draft.savedFile}`);
  await assert.rejects(prepareLiveRelease(f.draft, { root: f.root, configuration: f.configuration, verify: async () => {} }), /already staged/);
});

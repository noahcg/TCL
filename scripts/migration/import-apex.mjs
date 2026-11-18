import { open, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assert, canonicalJson, loadContent, snapshotFile, validateSnapshot } from '../../src/build/content.mjs';

const args = process.argv.slice(2);
const paths = args.filter(value => !value.startsWith('--'));
assert(paths.length <= 1 && args.every(value => !value.startsWith('--') || ['--apply', '--allow-removals'].includes(value)),
  'Usage: npm run content:verify -- [bundle.json] [--allow-removals]');
const apply = args.includes('--apply');
const lockFile = new URL('published.json.lock', snapshotFile);
const lock = apply ? await open(lockFile, 'wx').catch(error => {
  if (error.code === 'EEXIST') throw new Error('Another import owns the snapshot lock. Check for an active import before clearing a stale lock.');
  throw error;
}) : null;

try {
  await migrate();
} finally {
  if (lock) {
    await lock.close();
    await rm(lockFile, { force: true });
  }
}

async function migrate() {
  const source = paths[0] ?? snapshotFile;
  const previous = JSON.parse(await readFile(snapshotFile, 'utf8'));
  const input = JSON.parse(await readFile(source, 'utf8'));
  if (input.method === 'oracle-article-export' && input.quick?.length === 0 && input.resources?.length === 0) {
    validateSnapshot(input, false);
    delete input.integrity;
    input.quick = previous.quick;
    input.resources = previous.resources;
  }
  const { payload, seal, records } = validateSnapshot(input, !paths.length && !args.includes('--apply'));
  const oldRecords = validateSnapshot(previous, false).records;
  const oldPaths = new Map(oldRecords.map(record => [record.path, canonicalJson(record)]));
  const newPaths = new Set(records.map(record => record.path));
  const removed = [...oldPaths.keys()].filter(path => !newPaths.has(path));
  const updated = records.filter(record => {
    const prior = oldPaths.get(record.path);
    return prior && canonicalJson(record) !== prior;
  });
  if (paths.length && previous.method === 'oracle-article-export') {
    assert(payload.method === previous.method, 'An Oracle baseline requires an Oracle update');
    const oldIds = new Map(previous.articles.map(row => [row.sourceId, row.slug]));
    for (const row of payload.articles) {
      assert(!oldIds.has(row.sourceId) || oldIds.get(row.sourceId) === row.slug,
        `${row.sourceId}: published slug changed. Add and review a redirect first.`);
    }
  }
  assert(!removed.length || args.includes('--allow-removals'), `Missing previously published routes: ${removed.join(', ')}`);
  const sealed = { ...payload, integrity: seal };
  await loadContent(sealed);
  console.log(JSON.stringify({
    method: payload.method, integrity: seal, counts: Object.fromEntries(['article', 'quick-win', 'resource'].map(type => [type, records.filter(row => row.type === type).length])),
    articleCodeBlocks: records.filter(row => row.type === 'article').reduce((count, row) => count + row.codeBlocks, 0),
    added: [...newPaths].filter(path => !oldPaths.has(path)), changed: updated.map(row => row.path), removed,
  }, null, 2));

  if (apply) {
    const temp = `${fileURLToPath(snapshotFile)}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(sealed, null, 2) + '\n', { flag: 'wx' });
      await rename(temp, snapshotFile);
    } finally {
      await rm(temp, { force: true });
    }
  }
}

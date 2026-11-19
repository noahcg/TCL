import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminServer } from './server.mjs';
import { atomicWrite } from './store.mjs';
import { publishDraft } from './publish.mjs';
import { prepareLiveRelease, submitLiveRelease } from './live.mjs';

const exec = promisify(execFile);
const identity = 'cascade-lounge-editorial-studio';
const alive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
};
const localOrigin = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && /^\d+$/.test(url.port) && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
};

export async function findRunningStudio(root) {
  root = await realpath(root);
  let contents;
  try { contents = (await readFile(join(root, '.tcl-admin/server.lock'), 'utf8')).trim(); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!/^\d+$/.test(contents) || Number(contents) < 1) throw new Error('The studio lock is incomplete. Wait a moment and reopen the app.');
  const pid = Number(contents);
  if (!alive(pid)) return null;
  const metadata = await readFile(join(root, '.tcl-admin/server.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (metadata?.pid === pid && metadata.workspace === root && localOrigin(metadata.url)) {
    try {
      const response = await fetch(`${localOrigin(metadata.url)}/admin/health`, { signal: AbortSignal.timeout(2500) });
      const health = await response.json();
      if (response.ok && health.app === identity && health.pid === pid && health.workspace === root) return { url: `${localOrigin(metadata.url)}/admin/`, pid, owned: false };
    } catch { /* Check the live process before deciding whether it can be reused. */ }
  }
  // Compatibility with a studio started in Terminal before desktop support existed.
  if (process.platform === 'darwin') {
    const cwd = await exec('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).then(result => result.stdout).catch(() => '');
    if (cwd.split('\n').includes(`n${root}`)) {
      const listeners = await exec('/usr/sbin/lsof', ['-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN', '-Fn']).then(result => result.stdout).catch(() => '');
      for (const [, port] of listeners.matchAll(/^n127\.0\.0\.1:(\d+)$/gm)) {
        const origin = `http://127.0.0.1:${port}`;
        try {
          const response = await fetch(`${origin}/admin/`, { signal: AbortSignal.timeout(2500) });
          const html = await response.text();
          if (response.ok && html.includes('<title>Editorial Studio · The Cascade Lounge</title>') && /name="studio-session" content="[a-f0-9]{64}"/.test(html)) {
            return { url: `${origin}/admin/`, pid, owned: false };
          }
        } catch { /* Try another loopback listener belonging to the same workspace. */ }
      }
    }
  }
  throw new Error('Another studio process is still starting or is not responding. Wait a moment, or quit the existing studio before reopening.');
}

export async function startAdminService({ root = process.cwd(), port = 4174, ...options } = {}) {
  root = await realpath(root);
  const folder = join(root, '.tcl-admin');
  const lockPath = join(folder, 'server.lock');
  const metadataPath = join(folder, 'server.json');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  let lock;
  for (let attempt = 0; attempt < 3 && !lock; attempt++) {
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const running = await findRunningStudio(root);
      if (running) return { ...running, close: async () => {} };
      await rm(lockPath, { force: true });
    }
  }
  if (!lock) throw new Error('Could not acquire the studio workspace lock.');
  await lock.writeFile(String(process.pid));
  let server;
  let closing;
  const cleanup = async () => {
    await lock.close();
    if ((await readFile(lockPath, 'utf8').catch(() => '')).trim() === String(process.pid)) await rm(lockPath, { force: true });
    const metadata = await readFile(metadataPath, 'utf8').then(JSON.parse).catch(() => null);
    if (metadata?.pid === process.pid) await rm(metadataPath, { force: true });
  };
  const close = () => closing ??= (async () => {
    const closed = new Promise(resolve => server.close(resolve));
    await server.waitForIdle();
    await closed;
    await cleanup();
  })();
  try {
    server = await createAdminServer({ root, publisher: publishDraft, livePreparer: prepareLiveRelease, liveSubmitter: submitLiveRelease, ...options });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    const url = `http://127.0.0.1:${server.address().port}/admin/`;
    await atomicWrite(metadataPath, { app: identity, pid: process.pid, workspace: root, url });
    return { server, url, pid: process.pid, owned: true, close };
  } catch (error) {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await cleanup();
    throw error;
  }
}

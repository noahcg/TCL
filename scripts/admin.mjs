import { mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminServer } from '../src/admin/server.mjs';
import { publishDraft } from '../src/admin/publish.mjs';
import { prepareLiveRelease, submitLiveRelease } from '../src/admin/live.mjs';

const root = process.cwd();
// A single studio process owns the local state, even when a different port is requested.
await mkdir(join(root, '.tcl-admin'), { recursive: true, mode: 0o700 });
const lockPath = join(root, '.tcl-admin/server.lock');
let lock;
try { lock = await open(lockPath, 'wx'); } catch {
  console.error('A studio is already running, or a previous process left .tcl-admin/server.lock. Stop it before removing the lock.');
  process.exit(1);
}
await lock.writeFile(String(process.pid));

try {
  const server = await createAdminServer({ root, publisher: publishDraft, livePreparer: prepareLiveRelease, liveSubmitter: submitLiveRelease });
  server.on('error', async error => {
    console.error(`Studio could not start (${error.code || 'server error'}).`);
    await lock.close(); await rm(lockPath, { force: true }); process.exit(1);
  });
  server.listen(Number(process.env.TCL_ADMIN_PORT || 4174), '127.0.0.1', () => {
    console.log(`Private editorial studio: http://127.0.0.1:${server.address().port}/admin/`);
    console.log(process.env.OPENAI_API_KEY ? 'AI is configured. Scans and generation use your API billing.' : 'Add OPENAI_API_KEY to .env.local and restart to enable AI.');
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    await server.waitForIdle();
    await lock.close(); await rm(lockPath, { force: true }); process.exit(0);
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch {
  console.error('Studio could not load. Check .tcl-admin/state.json and the content files.');
  await lock.close(); await rm(lockPath, { force: true }); process.exit(1);
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findRunningStudio, startAdminService } from '../src/admin/runtime.mjs';

const exec = promisify(execFile);
let studio;
let stopping = false;
const send = message => new Promise(resolve => {
  if (process.connected) process.send(message, () => resolve()); else resolve();
});
const stop = async () => {
  if (stopping) return;
  stopping = true;
  if (studio?.owned) await studio.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('message', message => { if (message?.type === 'shutdown') void stop(); });
process.on('disconnect', () => { void stop(); });

try {
  studio = await findRunningStudio(process.cwd());
  if (!studio) {
    await exec(process.execPath, ['scripts/build.mjs'], { cwd: process.cwd(), timeout: 120_000, maxBuffer: 2_000_000 });
    studio = await startAdminService({ port: 0 });
  }
  await send({ type: 'ready', url: studio.url, pid: studio.pid, owned: studio.owned });
  if (!studio.owned) process.exit(0);
} catch (error) {
  await send({ type: 'error', message: error.code ? 'The studio could not start. Check that the TCL workspace dependencies are installed.' : error.message });
  process.exit(1);
}

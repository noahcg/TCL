import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtime = join(root, 'desktop/build/node-runtime');
const node = join(runtime, 'bin/node');
const npm = join(runtime, 'lib/node_modules/npm/bin/npm-cli.js');
const action = process.argv[2];
const commands = { setup: ['ci'], dev: ['start'], package: ['run', 'package'] };
if (!commands[action]) throw new Error('Choose setup, dev, or package.');
await access(node);
const environment = { ...process.env, PATH: `${join(runtime, 'bin')}:${process.env.PATH || '/usr/bin:/bin'}` };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(node, [npm, ...commands[action]], {
  cwd: join(root, 'desktop'), stdio: 'inherit',
  env: environment,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exitCode = code ?? 1; });

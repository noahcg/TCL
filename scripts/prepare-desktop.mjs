import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const exec = promisify(execFile);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desktop = join(root, 'desktop');
const build = join(desktop, 'build');
const version = '22.23.5';
if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch)) throw new Error('Desktop packaging currently supports macOS on Apple Silicon or Intel.');
const distribution = `node-v${version}-darwin-${process.arch}`;
const archiveName = `${distribution}.tar.gz`;
const cache = join(desktop, '.cache');
const runtime = join(cache, distribution);
const releaseUrl = `https://nodejs.org/download/release/v${version}/`;
await mkdir(cache, { recursive: true });

if (!await stat(join(runtime, 'bin/node')).catch(() => null)) {
  console.log(`Downloading official Node.js ${version} for the desktop app…`);
  const [manifestResponse, archiveResponse] = await Promise.all([
    fetch(`${releaseUrl}SHASUMS256.txt`, { signal: AbortSignal.timeout(30_000) }),
    fetch(`${releaseUrl}${archiveName}`, { signal: AbortSignal.timeout(180_000) }),
  ]);
  if (!manifestResponse.ok || !archiveResponse.ok) throw new Error('The official Node.js runtime could not be downloaded.');
  const manifest = await manifestResponse.text();
  const expected = manifest.split('\n').map(line => line.trim().split(/\s+/)).find(([, file]) => file === archiveName)?.[0];
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Node.js runtime checksum verification failed.');
  const archive = join(cache, archiveName);
  await writeFile(archive, bytes);
  const staging = join(cache, `.extract-${randomUUID()}`);
  await mkdir(staging);
  try {
    await exec('/usr/bin/tar', ['-xzf', archive, '-C', staging]);
    await rename(join(staging, distribution), runtime);
  } finally { await rm(staging, { recursive: true, force: true }); }
}
const { stdout: actualVersion } = await exec(join(runtime, 'bin/node'), ['--version']);
if (actualVersion.trim() !== `v${version}`) throw new Error('The cached Node.js runtime version does not match.');

await mkdir(build, { recursive: true });
await rm(join(build, 'node-runtime'), { recursive: true, force: true });
await cp(runtime, join(build, 'node-runtime'), { recursive: true, verbatimSymlinks: true });
await writeFile(join(build, 'workspace.json'), JSON.stringify({ workspaceRoot: root }, null, 2) + '\n');
const icon = await readFile(join(desktop, 'icon.svg'));
await sharp(icon).resize(1024, 1024).png().toFile(join(build, 'app-icon.png'));
const iconSet = join(build, 'app-icon.iconset');
await mkdir(iconSet, { recursive: true });
for (const [size, filename] of [[16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'], [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'], [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'], [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']]) {
  await sharp(icon).resize(size, size).png().toFile(join(iconSet, filename));
}
await exec('/usr/bin/iconutil', ['-c', 'icns', iconSet, '-o', join(build, 'app-icon.icns')]);
console.log('Prepared the desktop icon and bundled Node.js runtime. Credentials and editorial data stay in the TCL workspace.');

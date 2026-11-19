import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (process.platform !== 'darwin') throw new Error('This installer requires macOS.');
const root = fileURLToPath(new URL('..', import.meta.url));
const name = 'Cascade Lounge Editorial Studio';
const bundleId = 'com.noah.cascadelounge.editorialstudio';
const source = join(root, 'desktop/release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', `${name}.app`);
const target = join('/Applications', `${name}.app`);
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });
const info = bundle => JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(bundle, 'Contents/Info.plist')]));

if (!existsSync(source)) throw new Error('Build the desktop app first with npm run desktop:package.');
if (info(source).CFBundleIdentifier !== bundleId) throw new Error('The desktop build has an unexpected bundle identifier.');
if (existsSync(target)) {
  if (info(target).CFBundleIdentifier !== bundleId) throw new Error('A different app already uses the installation path.');
  // Do not replace a running application. Quit it first so updates are predictable.
  const statusFile = join(process.env.HOME, 'Library/Application Support', name, 'desktop-status.json');
  let status;
  try { status = JSON.parse(readFileSync(statusFile, 'utf8')); } catch { /* No previous launch. */ }
  if (status?.pid) {
    let running = false;
    try { process.kill(status.pid, 0); running = true; } catch { /* Previous process has stopped. */ }
    if (running) throw new Error('Quit Cascade Lounge Editorial Studio before installing an update.');
  }
}
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', source]);
run('/usr/bin/ditto', [source, target]);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', target]);
run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', target]);

// Update only persistent-apps, retaining the user's existing Dock tiles and order.
// Dock bookmarks contain plist data objects, so preserve XML instead of converting to JSON.
const readDock = () => run('/usr/bin/plutil', ['-extract', 'persistent-apps', 'xml1', '-o', '-', '-'], {
  input: run('/usr/bin/defaults', ['export', 'com.apple.dock', '-']),
});
const preferences = readDock();
const url = pathToFileURL(target).href + '/';
const pinned = preferences.includes(`<string>${bundleId}</string>`) || preferences.includes(`<string>${url}</string>`);
if (!pinned) {
  // XML keeps URL and file types as integers. The old ASCII plist format makes
  // them strings, causing modern Dock versions to silently discard the tile.
  const tile = `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
    <key>tile-data</key><dict><key>file-data</key><dict>
      <key>_CFURLString</key><string>${url}</string><key>_CFURLStringType</key><integer>15</integer>
    </dict><key>file-label</key><string>${name}</string>
    <key>bundle-identifier</key><string>${bundleId}</string><key>file-type</key><integer>41</integer></dict>
    <key>tile-type</key><string>file-tile</string></dict></plist>`;
  run('/usr/bin/defaults', ['write', 'com.apple.dock', 'persistent-apps', '-array-add', tile]);
  run('/usr/bin/killall', ['Dock']);
  await new Promise(resolve => setTimeout(resolve, 2000));
  if (!readDock().includes(`<string>${bundleId}</string>`)) throw new Error('The app was installed, but macOS did not retain its Dock icon.');
}
console.log(`Installed ${target}\n${pinned ? 'Already pinned to' : 'Added to'} the Dock.`);
if (!process.argv.includes('--no-open')) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  run('/usr/bin/open', ['-a', target], { env: environment });
}

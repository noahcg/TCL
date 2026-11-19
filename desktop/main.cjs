const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const name = 'Cascade Lounge Editorial Studio';
app.setName(name);
app.setPath('userData', path.join(app.getPath('appData'), name));
const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'build');
const support = app.getPath('userData');
fs.mkdirSync(support, { recursive: true, mode: 0o700 });
const logFile = path.join(support, 'desktop.log');
const log = message => fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`, { mode: 0o600 });

let window;
let child;
let workspace;
let studio;
let quitting = false;
let allowQuit = false;

function writeStatus(ready = false) {
  const activeWindow = window && !window.isDestroyed() ? window : null;
  fs.writeFileSync(path.join(support, 'desktop-status.json'), JSON.stringify({
    pid: process.pid, serverPid: studio?.pid, url: studio?.url, workspace,
    ownsServer: studio?.owned ?? false, ready, windowVisible: activeWindow?.isVisible() ?? false,
    title: activeWindow?.getTitle() || name,
  }, null, 2) + '\n', { mode: 0o600 });
}

function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  writeStatus(true);
}

function isWorkspace(folder) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    return manifest.name === 'the-cascade-lounge' && fs.existsSync(path.join(folder, 'scripts/desktop-server.mjs'));
  } catch { return false; }
}

async function findWorkspace() {
  const configFile = path.join(support, 'config.json');
  const readRoot = file => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')).workspaceRoot; } catch { return null; }
  };
  const candidates = [readRoot(configFile), readRoot(path.join(resources, 'workspace.json')),
    !app.isPackaged && path.resolve(__dirname, '..'), path.join(os.homedir(), 'Sites', 'TCL')];
  let folder = candidates.find(candidate => candidate && isWorkspace(candidate));
  if (!folder) {
    const selected = await dialog.showOpenDialog({ title: 'Choose your TCL project folder',
      message: 'The studio uses your TCL project for drafts, content, and publishing.',
      properties: ['openDirectory'], buttonLabel: 'Use this project' });
    if (selected.canceled) return null;
    folder = selected.filePaths[0];
    if (!isWorkspace(folder)) throw new Error('That folder is not the TCL project. Choose the folder containing its package.json and scripts directory.');
  }
  folder = fs.realpathSync(folder);
  fs.writeFileSync(configFile, JSON.stringify({ workspaceRoot: folder }, null, 2) + '\n', { mode: 0o600 });
  return folder;
}

function startServer() {
  const node = path.join(resources, 'node-runtime', 'bin', 'node');
  if (!fs.existsSync(node)) throw new Error('The bundled Node.js runtime is missing. Rebuild or reinstall the desktop app.');
  const environment = { ...process.env, PATH: [path.dirname(node), '/opt/homebrew/bin', '/usr/local/bin',
    '/usr/bin', '/bin', '/usr/sbin', '/sbin', process.env.PATH || ''].join(path.delimiter) };
  delete environment.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('The local studio took too long to start. Check the desktop log and reopen the app.')), 135_000);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error); else resolve(result);
    };
    child = spawn(node, ['--env-file-if-exists=.env.local', 'scripts/desktop-server.mjs'], {
      cwd: workspace, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout.on('data', data => log(String(data).trim()));
    child.stderr.on('data', data => log(String(data).trim()));
    child.on('message', message => {
      if (message?.type === 'error') finish(new Error(message.message));
      if (message?.type !== 'ready') return;
      try {
        const url = new URL(message.url);
        if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/admin/' || url.username || url.password) throw new Error('Invalid local studio address.');
        finish(null, { url: url.href, pid: message.pid, owned: message.owned === true });
      } catch (error) { finish(error); }
    });
    child.on('error', error => finish(error));
    child.on('exit', code => {
      finish(new Error(`The local studio stopped before startup completed (exit ${code}).`));
      if (studio?.owned && !quitting) {
        log(`Owned studio stopped (exit ${code}).`);
        writeStatus(false);
        dialog.showErrorBox('The local studio stopped', 'Quit and reopen the app to reconnect. Your saved drafts remain in the TCL project.');
      }
    });
  });
}

function openLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === new URL(studio.url).origin)) void shell.openExternal(url.href);
  } catch { /* Ignore unsupported link schemes. */ }
}

function createWindow() {
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 780, minHeight: 640,
    title: name, backgroundColor: '#101a13', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.setWindowOpenHandler(({ url }) => { openLink(url); return { action: 'deny' }; });
  const navigation = (event, value) => {
    value = event.url ?? value;
    try { if (new URL(value).origin === new URL(studio.url).origin) return; } catch { /* Deny invalid URLs. */ }
    event.preventDefault();
    openLink(value);
  };
  window.webContents.on('will-navigate', navigation);
  window.webContents.on('will-redirect', navigation);
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('page-title-updated', event => { event.preventDefault(); window.setTitle(name); });
  window.once('ready-to-show', showWindow);
  window.on('close', event => {
    if (!quitting) { event.preventDefault(); window.hide(); writeStatus(true); }
  });
  window.on('show', () => writeStatus(true));
  window.on('hide', () => writeStatus(true));
  return window.loadURL(studio.url);
}

function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: name, submenu: [
      { role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'File', submenu: [
      { label: 'Open Editorial Studio', accelerator: 'CmdOrCtrl+1', click: showWindow },
      { label: 'View local site', click: () => studio && openLink(new URL('/', studio.url).href) },
      { label: 'Open TCL project folder', click: () => workspace && void shell.openPath(workspace) },
      { type: 'separator' }, { role: 'close' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Open desktop log', click: () => void shell.openPath(logFile) },
      { label: 'Editorial Studio guide', click: () => workspace && void shell.openPath(path.join(workspace, 'docs/editorial-studio.md')) },
    ] },
  ]));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('window-all-closed', () => { /* Keep the Dock app available until Command-Q. */ });
  app.on('before-quit', event => {
    if (allowQuit) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    const finish = () => { writeStatus(false); allowQuit = true; app.quit(); };
    if (child?.exitCode === null && child.connected) {
      child.once('exit', finish);
      child.send({ type: 'shutdown' }, error => { if (error) log('The server connection closed during shutdown.'); });
    } else finish();
  });
  app.whenReady().then(async () => {
    try {
      workspace = await findWorkspace();
      if (!workspace) { app.quit(); return; }
      createMenu();
      log('Starting the local studio.');
      studio = await startServer();
      log(`${studio.owned ? 'Started' : 'Reused'} the local studio on ${new URL(studio.url).host}.`);
      await createWindow();
      writeStatus(true);
    } catch (error) {
      log(error.message);
      dialog.showErrorBox('Could not open Editorial Studio', `${error.message}\n\nYour content and credentials stay in the TCL project. See Help → Open desktop log for details.`);
      app.quit();
    }
  });
}

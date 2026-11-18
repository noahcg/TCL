import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, symlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkedRecord, sourceUrl } from '../build/content.mjs';
import { imageIsCurrent } from '../build/article-media.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
const shaPattern = /^[a-f0-9]{40,64}$/;
const releaseDirectory = (root, id) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid release.');
  return join(root, '.tcl-admin/releases', id);
};

function command(binary, args, cwd, { env = gitEnv, timeout = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { cwd, env, timeout, maxBuffer: 8_000_000 }, (error, stdout) => {
      if (error) reject(error); else resolve(stdout.trim());
    });
  });
}

const git = (root, args) => command('git', args, root);
const optionalGit = (root, args) => git(root, args).catch(() => '');

function githubRepository(url) {
  const ssh = /^git@github\.com:([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url);
  if (ssh) return ssh[1];
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
    const repository = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error();
    return repository;
  } catch { throw new Error('Live publishing requires a GitHub HTTPS or SSH remote without embedded credentials.'); }
}

export async function liveConfiguration(root) {
  const name = process.env.TCL_LIVE_REMOTE || 'vercel';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid TCL_LIVE_REMOTE setting.');
  const url = await optionalGit(root, ['remote', 'get-url', '--push', name]);
  if (!url) throw new Error(`Configure the ${name} Git remote before publishing live.`);
  const repository = githubRepository(url);
  const remotes = [{ name, url, repository }];
  const mirror = await optionalGit(root, ['remote', 'get-url', '--push', 'origin']);
  if (mirror && mirror !== url) remotes.unshift({ name: 'origin', url: mirror, repository: githubRepository(mirror) });
  const siteUrl = process.env.TCL_SITE_URL || null;
  if (siteUrl && (!sourceUrl(siteUrl) || new URL(siteUrl).origin !== siteUrl.replace(/\/$/, ''))) throw new Error('TCL_SITE_URL must be an HTTPS site origin.');
  return { branch: 'main', remotes, productionRemote: name, repository, siteUrl };
}

async function branchHead(root, remote, branch) {
  try {
    const result = await git(root, ['ls-remote', remote.url, `refs/heads/${branch}`]);
    const sha = result.split(/\s+/)[0];
    if (!shaPattern.test(sha)) throw new Error();
    return sha;
  } catch { throw new Error(`Could not read ${remote.name}/${branch}. Check your GitHub sign-in and network connection.`); }
}

async function verifyCandidate(checkout) {
  try {
    await command('npm', ['run', 'verify'], checkout, { env: { ...process.env, OPENAI_API_KEY: '', CONTEXT: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '' } });
  } catch { throw new Error('Release checks failed. Run npm run verify in your project for details, then prepare the release again.'); }
}

async function publicationFiles(root, draft) {
  if (!draft.publishedAt || !['article', 'quick-win'].includes(draft.type) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)
    || draft.savedFile !== `${draft.type}-${draft.slug}.json`) throw new Error('Add this draft to the local site before preparing a live publication.');
  const path = `content/authored/${draft.savedFile}`;
  const bytes = await readFile(join(root, path));
  const record = JSON.parse(bytes);
  checkedRecord(record);
  if (record.adminDraftId !== draft.id || record.status !== 'published' || record.slug !== draft.slug || record.type !== draft.type) throw new Error('The local content file changed. Review it before publishing live.');
  const files = new Map([[path, bytes]]);
  const snapshot = { [path]: hash(bytes) };
  let image;
  if (record.type === 'article') {
    const catalogBytes = await readFile(join(root, 'content/media/article-images.json'));
    const catalog = JSON.parse(catalogBytes);
    image = catalog.images?.[record.slug];
    if (!imageIsCurrent(record, image) || !/^[a-f0-9]{64}$/.test(image.sha256 || '')
      || image.path !== `/assets/articles/${record.slug}-${image.sha256.slice(0, 16)}.jpg`) throw new Error('The article artwork is missing or stale. Prepare it locally first.');
    const path = `src${image.path}`;
    const bytes = await readFile(join(root, path));
    const metadata = await sharp(bytes).metadata();
    if (hash(bytes) !== image.sha256 || metadata.format !== 'jpeg' || metadata.width !== 1200 || metadata.height !== 630) throw new Error('Article artwork failed verification.');
    files.set(path, bytes);
    snapshot[path] = hash(bytes);
    snapshot['content/media/article-images.json'] = hash(catalogBytes);
  }
  return { record, files, snapshot, image };
}

export async function prepareLiveRelease(draft, { root, configuration, verify = verifyCandidate } = {}) {
  const config = configuration || await liveConfiguration(root);
  const branch = await git(root, ['branch', '--show-current']);
  if (branch !== config.branch) throw new Error(`Switch to ${config.branch} before preparing a live publication.`);
  const base = await git(root, ['rev-parse', 'HEAD']);
  for (const remote of config.remotes) {
    if (await branchHead(root, remote, config.branch) !== base) throw new Error(`${remote.name}/${config.branch} differs from this checkout. Sync your repositories before preparing a live publication.`);
  }
  const name = await optionalGit(root, ['config', '--get', 'user.name']);
  const email = await optionalGit(root, ['config', '--get', 'user.email']);
  if (!name || !email) throw new Error('Set your Git user.name and user.email before preparing a live publication.');
  const { record, files, snapshot, image } = await publicationFiles(root, draft);
  const id = randomUUID();
  const checkout = releaseDirectory(root, id);
  await mkdir(join(root, '.tcl-admin/releases'), { recursive: true, mode: 0o700 });
  try {
    await git(root, ['clone', '--no-hardlinks', '--no-checkout', '--', root, checkout]);
    await git(checkout, ['checkout', '--detach', base]);
    await git(checkout, ['config', 'user.name', name]);
    await git(checkout, ['config', 'user.email', email]);
    if (image) {
      const catalogPath = 'content/media/article-images.json';
      const catalog = JSON.parse(await readFile(join(checkout, catalogPath), 'utf8'));
      catalog.images[record.slug] = image;
      files.set(catalogPath, Buffer.from(JSON.stringify(catalog, null, 2) + '\n'));
    }
    const paths = [...files.keys()].sort();
    // A staged version of one of these files belongs to the user; leave it alone.
    if (await git(root, ['diff', '--cached', '--name-only', '--', ...paths])) throw new Error('One of the release files is already staged. Commit or unstage it before preparing this release.');
    for (const [path, bytes] of files) {
      await mkdir(join(checkout, path, '..'), { recursive: true });
      await writeFile(join(checkout, path), bytes);
    }
    if (await stat(join(root, 'node_modules')).catch(() => null)) {
      const localLock = await readFile(join(root, 'package-lock.json'));
      const releaseLock = await readFile(join(checkout, 'package-lock.json'));
      if (hash(localLock) !== hash(releaseLock)) throw new Error('Dependency versions differ from the live branch. Sync the lockfile and install dependencies before preparing the release.');
      await symlink(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
    }
    await verify(checkout);
    await git(checkout, ['add', '--', ...paths]);
    const changed = await git(checkout, ['diff', '--cached', '--name-only']);
    if (!changed) throw new Error('This content already matches the live repository.');
    const changedPaths = changed.split('\n').sort();
    const index = await git(root, ['ls-files', '--stage', '-z', '--', ...changedPaths]);
    await git(checkout, ['commit', '-m', `Publish ${record.type === 'article' ? 'article' : 'Quick Win'}: ${record.title.replace(/[\r\n]/g, ' ').slice(0, 200)}`]);
    const commit = await git(checkout, ['rev-parse', 'HEAD']);
    const diff = await git(checkout, ['show', '--format=', '--no-ext-diff', '--no-renames', '--', ...paths.filter(path => path.endsWith('.json'))]);
    return { id, draftId: draft.id, title: record.title, type: record.type, slug: record.slug, base, commit, config,
      files: changedPaths.map(path => ({ path, sha256: hash(files.get(path)), bytes: files.get(path).length })), snapshot, index,
      diff, status: 'ready', checks: 'Content verification, tests, and site build passed', createdAt: new Date().toISOString(), pushed: [] };
  } catch (error) {
    if (error.code) throw new Error('Could not prepare the release. Check Git access, file permissions, and installed dependencies.');
    throw error;
  }
}

async function attachRelease(root, release, checkout) {
  if (await git(root, ['branch', '--show-current']) !== release.config.branch) throw new Error('The active Git branch changed. Switch back before publishing.');
  const head = await git(root, ['rev-parse', 'HEAD']);
  if (head === release.commit) return; // A previous push attempt may have stopped after committing locally.
  if (head !== release.base) throw new Error('Your local Git history changed. Prepare a new release for approval.');
  for (const [path, expected] of Object.entries(release.snapshot)) {
    if (hash(await readFile(join(root, path))) !== expected) throw new Error('The content or artwork changed after review. Prepare a new release for approval.');
  }
  const paths = release.files.map(file => file.path);
  if (await git(root, ['ls-files', '--stage', '-z', '--', ...paths]) !== release.index) throw new Error('Staged release files changed after review. Prepare the release again.');
  await git(root, ['fetch', '--no-tags', '--', checkout, release.commit]);
  // Update just the approved index entries. Other staged edits and all working files stay intact.
  await git(root, ['restore', '--staged', `--source=${release.commit}`, '--', ...paths]);
  try { await git(root, ['update-ref', `refs/heads/${release.config.branch}`, release.commit, release.base]); }
  catch {
    await git(root, ['restore', '--staged', `--source=${release.base}`, '--', ...paths]);
    throw new Error('Git history changed during publication. Review the checkout before retrying.');
  }
}

export async function submitLiveRelease(release, { root, onChange = async () => {} } = {}) {
  if (!['ready', 'failed'].includes(release.status)) throw new Error('This release has already been submitted.');
  const checkout = releaseDirectory(root, release.id);
  try {
    if (await git(checkout, ['rev-parse', 'HEAD']) !== release.commit) throw new Error('The prepared release changed. Prepare it again.');
    const paths = (await git(checkout, ['diff-tree', '--no-commit-id', '--name-only', '-r', release.commit])).split('\n').filter(Boolean).sort();
    const expected = release.files.map(file => file.path).sort();
    if (JSON.stringify(paths) !== JSON.stringify(expected)) throw new Error('The release file list changed. Prepare it again.');
    for (const remote of release.config.remotes) {
      const head = await branchHead(root, remote, release.config.branch);
      if (head !== release.base && head !== release.commit) throw new Error(`${remote.name}/${release.config.branch} changed since review. Sync the repositories before publishing.`);
    }
    await attachRelease(root, release, checkout);
    release.status = 'publishing'; release.error = null;
    await onChange();
    for (const remote of release.config.remotes) {
      if (await branchHead(root, remote, release.config.branch) !== release.commit) {
        try { await git(checkout, ['push', '--porcelain', remote.url, `${release.commit}:refs/heads/${release.config.branch}`]); }
        catch { throw new Error(`Push to ${remote.name} did not complete. Check GitHub access and the branch, then retry this release. Existing pushes are kept.`); }
      }
      if (!release.pushed.includes(remote.name)) release.pushed.push(remote.name);
      await onChange();
    }
    release.status = 'submitted'; release.submittedAt = new Date().toISOString();
    await onChange();
    return release;
  } catch (error) {
    release.status = 'failed';
    release.error = error.code ? 'Git could not complete the release. Check repository access and file permissions, then retry.' : error.message;
    await onChange();
    throw new Error(release.error);
  }
}

export function releaseSummary(release) {
  return { id: release.id, draftId: release.draftId, title: release.title, type: release.type, slug: release.slug,
    commit: release.commit, files: release.files, diff: release.diff, checks: release.checks, status: release.status,
    createdAt: release.createdAt, submittedAt: release.submittedAt, error: release.error, pushed: release.pushed,
    repository: release.config.repository, branch: release.config.branch,
    deploymentUrl: `https://github.com/${release.config.repository}/commit/${release.commit}/checks`,
    liveUrl: release.config.siteUrl ? `${release.config.siteUrl.replace(/\/$/, '')}/${release.type === 'article' ? 'articles' : 'quick-wins'}/${release.slug}/` : null };
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import { checkedRecord, loadContent } from '../build/content.mjs';
import { researchSources, scanWeb, generateDraft } from './ai.mjs';
import { draftRecord, readState, persistState, saveDraft } from './store.mjs';
import { releaseSummary } from './live.mjs';

const security = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https: data:; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'no-store',
};
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const idPattern = /^[a-f0-9-]{36}$/;

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 180_000) throw new Error('The draft is too large.');
  }
  try { return JSON.parse(body); } catch { throw new Error('Invalid request data.'); }
}

export async function createAdminServer({ root = process.cwd(), apiKey = process.env.OPENAI_API_KEY,
  model = process.env.TCL_EDITOR_MODEL || 'gpt-6.2-astra', scanner = scanWeb, generator = generateDraft,
  inventoryLoader = () => loadContent(null, { includeUnpublished: true }), publisher, livePreparer, liveSubmitter } = {}) {
  const token = randomBytes(32).toString('hex');
  const state = await readState(root);
  state.releases ??= [];
  // A stopped process may have submitted only one of the two Git pushes. Allow an explicit retry.
  for (const release of state.releases) if (release.status === 'publishing') {
    release.status = 'failed'; release.error = 'Publication was interrupted. Review the release and retry to finish any remaining push.';
  }
  let job = null;
  let pendingJob = Promise.resolve();
  let mutating = false;
  const options = { apiKey, model };
  const findIdea = id => state.scans.flatMap(scan => scan.ideas).find(idea => idea.id === id);
  const findDraft = id => state.drafts.find(draft => draft.id === id);
  const runJob = (type, work) => {
    if (job?.status === 'running') throw new Error('Another task is running. Wait for it to finish.');
    job = { type, status: 'running', startedAt: new Date().toISOString() };
    pendingJob = Promise.resolve().then(work).then(async result => {
      await persistState(root, state);
      job = { ...job, status: 'complete', resultId: result?.id };
    }).catch(error => {
      job = { ...job, status: 'error', error: error.message };
    });
  };
  const server = createServer(async (request, response) => {
    const send = (status, data, type = 'application/json') => {
      response.writeHead(status, { ...security, 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : type === 'application/json' ? JSON.stringify(data) : data);
    };
    // Exact loopback Host validation also blocks DNS rebinding. Never bind this server publicly.
    const expectedHost = `127.0.0.1:${server.address()?.port}`;
    if (request.headers.host !== expectedHost || request.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Local studio access only.' });
    let url;
    try { url = new URL(request.url, `http://${expectedHost}`); } catch { return send(400, { error: 'Invalid URL.' }); }
    if (url.pathname.startsWith('/admin/api/')) {
      const supplied = Buffer.from(request.headers['x-admin-token'] || '');
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return send(403, { error: 'Refresh the studio to reconnect.' });
      if (request.headers.origin && request.headers.origin !== `http://${expectedHost}`) return send(403, { error: 'Invalid request origin.' });
      if (request.method === 'GET' && url.pathname === '/admin/api/state') {
        try {
          const inventory = await inventoryLoader();
          return send(200, { ...state, releases: state.releases.map(releaseSummary), livePublishing: Boolean(livePreparer && liveSubmitter), job, sources: researchSources, configured: Boolean(apiKey), model,
            inventory: inventory.map(({ title, type, path, status }) => ({ title, type, path, status })) });
        } catch { return send(500, { error: 'Could not load content. Check the studio terminal.' }); }
      }
      if (request.method !== 'POST') return send(405, { error: 'Method not allowed.' });
      if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
      if (job?.status === 'running' || mutating) return send(409, { error: 'Another task is running. Wait for it to finish.' });
      mutating = true;
      try {
        const body = await readJson(request);
        if (url.pathname === '/admin/api/scan') {
          if (!apiKey) throw new Error('Set OPENAI_API_KEY in .env.local, then restart the studio.');
          runJob('scan', async () => {
            const scan = await scanner({ sourceIds: body.sourceIds, days: body.days, focus: body.focus,
              inventory: await inventoryLoader(), previousIdeas: state.scans.flatMap(scan => scan.ideas), ...options });
            state.scans.unshift(scan);
            return scan;
          });
          return send(202, { accepted: true });
        }
        if (!idPattern.test(body.id || '')) throw new Error('Choose a valid idea or draft.');
        if (url.pathname === '/admin/api/prepare-live') {
          const draft = findDraft(body.id);
          if (!draft?.publishedAt) throw new Error('Add the draft to your local site before preparing a live publication.');
          if (!livePreparer) throw new Error('Live publishing is unavailable. Restart the studio with npm run admin.');
          runJob('prepare-live', async () => {
            const release = await livePreparer(draft, { root });
            state.releases.unshift(release);
            return release;
          });
          return send(202, { accepted: true });
        }
        if (url.pathname === '/admin/api/deploy-live') {
          const release = state.releases.find(release => release.id === body.id);
          if (!release || body.approved !== true) throw new Error('Review and explicitly approve this release before publishing live.');
          if (!liveSubmitter) throw new Error('Live publishing is unavailable. Restart the studio with npm run admin.');
          runJob('deploy-live', async () => {
            await liveSubmitter(release, { root, onChange: () => persistState(root, state) });
            return release;
          });
          return send(202, { accepted: true });
        }
        if (url.pathname === '/admin/api/generate') {
          if (!apiKey) throw new Error('Set OPENAI_API_KEY in .env.local, then restart the studio.');
          const idea = findIdea(body.id);
          if (!idea) throw new Error('Idea not found.');
          const existing = state.drafts.find(draft => draft.ideaId === idea.id);
          if (existing) return send(200, { id: existing.id });
          runJob('generate', async () => {
            const draft = await generator(idea, { ...options, researchBrief: state.scans.find(scan => scan.ideas.some(entry => entry.id === idea.id))?.brief || '' });
            checkedRecord(draftRecord(draft));
            state.drafts.unshift(draft);
            idea.status = 'drafted';
            return draft;
          });
          return send(202, { accepted: true });
        }
        if (url.pathname === '/admin/api/dismiss') {
          const idea = findIdea(body.id);
          if (!idea) throw new Error('Idea not found.');
          idea.status = body.restore ? 'new' : 'dismissed';
          await persistState(root, state);
          return send(200, { ok: true });
        }
        const previous = findDraft(body.id);
        if (!previous) throw new Error('Draft not found.');
        if (previous.publishedAt && url.pathname !== '/admin/api/preview') throw new Error('This draft has already been added to the site. Edit its content file for further changes.');
        const edited = { ...previous };
        for (const key of ['title', 'slug', 'summary', 'body', 'code', 'note', 'difficulty']) {
          if (key in body) {
            if (typeof body[key] !== 'string') throw new Error('Invalid draft field.');
            edited[key] = body[key];
          }
        }
        if (body.tags !== undefined) {
          if (!Array.isArray(body.tags) || !body.tags.every(tag => typeof tag === 'string')) throw new Error('Invalid tags.');
          edited.tags = body.tags;
        }
        const record = draftRecord(edited);
        if (url.pathname === '/admin/api/preview') return send(200, { html: checkedRecord(record).html });
        if (!['/admin/api/save', '/admin/api/publish'].includes(url.pathname)) return send(404, { error: 'Unknown action.' });
        const saved = await saveDraft(root, edited, await inventoryLoader());
        Object.assign(previous, saved);
        await persistState(root, state);
        if (url.pathname === '/admin/api/save') return send(200, { id: saved.id, file: `content/authored/${saved.savedFile}` });
        if (!publisher) throw new Error('Local publishing is unavailable. Your draft is saved.');
        runJob('publish', async () => {
          await publisher(saved, { root, apiKey });
          previous.publishedAt = new Date().toISOString();
          return previous;
        });
        return send(202, { accepted: true });
      } catch (error) {
        return send(400, { error: error.code ? 'Could not save studio data. Check file permissions and try again.' : error.message });
      } finally { mutating = false; }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return send(405, { error: 'Method not allowed.' });
    try {
      if (url.pathname === '/admin') {
        response.writeHead(308, { ...security, Location: '/admin/' }).end();
        return;
      }
      if (url.pathname === '/admin/') {
        const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
        return send(200, html.replace('STUDIO_SESSION_TOKEN', token), mime['.html']);
      }
      if (['/admin/studio.css', '/admin/studio.js'].includes(url.pathname)) {
        return send(200, await readFile(new URL(`.${url.pathname.slice(6)}`, import.meta.url)), mime[extname(url.pathname)]);
      }
      if (url.pathname.startsWith('/admin/')) return send(404, 'Not found.', 'text/plain');
      const directory = resolve(root, 'dist');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid path');
      const path = resolve(directory, `.${pathname}`);
      if (!path.startsWith(directory + sep) && path !== directory) throw new Error('Invalid path');
      const file = extname(path) ? path : join(path, 'index.html');
      return send(200, await readFile(file), mime[extname(file)] || 'application/octet-stream');
    } catch { return send(404, 'Page not found. Run npm run build to preview the site.', 'text/plain'); }
  });
  server.waitForIdle = () => pendingJob;
  return server;
}

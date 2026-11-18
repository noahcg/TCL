import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './store.mjs';
import { generateArticleImage } from '../build/image-generation.mjs';
import { imageIsCurrent, readMediaCatalog, saveArticleImage, validateArticleImage, mediaCatalogFile } from '../build/article-media.mjs';

const exec = promisify(execFile);
async function buildSite(root) {
  await exec(process.execPath, ['scripts/build.mjs'], { cwd: root, timeout: 120_000, maxBuffer: 2_000_000 });
}

async function ensureArticleArtwork(draft, apiKey) {
  const imageLockFile = new URL('.article-images.lock', mediaCatalogFile);
  const imageLock = await open(imageLockFile, 'wx').catch(() => { throw new Error('Another image process is running. Try again once it finishes.'); });
  try {
    const catalog = await readMediaCatalog();
    if (imageIsCurrent(draft, catalog.images[draft.slug])) await validateArticleImage(draft, catalog.images[draft.slug]);
    else {
      const model = process.env.TCL_IMAGE_MODEL || 'gpt-image-2';
      const bytes = await generateArticleImage(draft, { apiKey, model });
      await saveArticleImage(draft, bytes, { catalog, generatedBy: `openai:${model}` });
    }
  } finally { await imageLock.close(); await rm(imageLockFile, { force: true }); }
}

export async function publishDraft(draft, { root, apiKey, build = buildSite, prepareArtwork = ensureArticleArtwork }) {
  const file = join(root, 'content/authored', draft.savedFile);
  const originalText = await readFile(file, 'utf8');
  const original = JSON.parse(originalText);
  if (original.status !== 'draft' || original.adminDraftId !== draft.id) throw new Error('The content file changed. Review it before publishing.');
  if (draft.type === 'article') await prepareArtwork(draft, apiKey);
  if (await readFile(file, 'utf8') !== originalText) throw new Error('The draft was edited while preparing artwork. Review it before publishing.');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const published = { ...original, status: 'published', date };
  await atomicWrite(file, published);
  try { await build(root); } catch {
    // Preserve manual edits made during a build rather than replacing them with our snapshot.
    if (JSON.stringify(JSON.parse(await readFile(file, 'utf8'))) !== JSON.stringify(published)) {
      throw new Error('The build failed and the file changed outside the studio. Review the content file and run npm run build.');
    }
    await atomicWrite(file, original);
    await build(root).catch(() => {});
    throw new Error('The build failed, so the content was restored to draft. Run npm run build for details.');
  }
}

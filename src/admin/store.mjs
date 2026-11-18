import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkedRecord } from '../build/content.mjs';

export async function readState(root) {
  try {
    const state = JSON.parse(await readFile(join(root, '.tcl-admin/state.json'), 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.scans) || !Array.isArray(state.drafts)) throw new Error('Invalid studio data.');
    return state;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { version: 1, scans: [], drafts: [] };
  }
}

export async function atomicWrite(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temporary, file);
}

export async function persistState(root, state) {
  await mkdir(join(root, '.tcl-admin'), { recursive: true, mode: 0o700 });
  await atomicWrite(join(root, '.tcl-admin/state.json'), state);
}

export function draftRecord(draft) {
  if (typeof draft.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) || draft.slug.length > 130) throw new Error('Use a lowercase URL slug with letters, numbers and hyphens.');
  if (!['article', 'quick-win'].includes(draft.type) || !draft.title?.trim() || !draft.summary?.trim()
    || !draft.body?.trim() || draft.body.length > 100_000) throw new Error('A title, summary and body are required.');
  if (draft.type === 'quick-win' && (!draft.code?.trim() || !draft.body.includes(draft.code))) throw new Error('Include the Quick Win CSS snippet in the body as well.');
  const record = { type: draft.type, slug: draft.slug, title: draft.title, summary: draft.summary, status: 'draft', format: 'markdown',
    body: draft.body, tags: draft.tags, updatedAt: new Date().toISOString(),
    source: draft.sources[0]?.url, adminDraftId: draft.id,
    ...(draft.type === 'quick-win' ? { code: draft.code, note: draft.note, difficulty: draft.difficulty } : {}) };
  checkedRecord(record);
  return record;
}

export async function saveDraft(root, draft, inventory) {
  const record = draftRecord(draft);
  const filename = `${record.type}-${record.slug}.json`;
  if (draft.savedFile && draft.savedFile !== filename) throw new Error('Keep the saved URL slug stable. Create a new draft to use a different URL.');
  if (inventory.some(entry => entry.type === record.type && entry.slug === record.slug && entry.adminDraftId !== draft.id)) throw new Error('That URL is already used by existing content. Choose a different slug.');
  const directory = join(root, 'content/authored');
  await mkdir(directory, { recursive: true });
  const file = join(directory, filename);
  if (draft.savedFile) {
    const previous = JSON.parse(await readFile(file, 'utf8'));
    if (previous.status !== 'draft' || previous.adminDraftId !== draft.id) throw new Error('This file has already been published or changed outside the studio.');
    await atomicWrite(file, record);
  } else {
    await writeFile(file, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 }).catch(error => {
      if (error.code === 'EEXIST') throw new Error('A content file already uses that slug. Choose another one.');
      throw error;
    });
  }
  return { ...draft, savedFile: filename, savedAt: record.updatedAt };
}

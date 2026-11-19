import { articleDemos } from './article-demos.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const demoArticles = { 'container-queries': 'container-query-units', 'fluid-type': 'container-query-units', ...Object.fromEntries(Object.keys(articleDemos).map(id => [id,id])) };
export const topics = ['container-queries', 'fluid-type', 'aspect-ratio', ...Object.keys(articleDemos)];
export function validateFeature(config) {
  if (config.version !== 1 || !['monthly', 'manual'].includes(config.mode) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(config.startMonth || '') || !topics.includes(config.pinned)) throw new Error('Choose a valid rotation mode, start month and pinned topic.');
  if (!Array.isArray(config.queue) || !config.queue.length || config.queue.length > topics.length || new Set(config.queue).size !== config.queue.length || config.queue.some(id => !topics.includes(id))) throw new Error('Choose at least one unique supported topic.');
  for (const id of topics) {
    const item = config.features?.[id];
    for (const key of ['topic', 'headline', 'explanation', 'demoTitle', 'demoDescription']) if (typeof item?.[key] !== 'string' || !item[key].trim() || item[key].length > 1000) throw new Error('Each topic needs a title, headline and explanation (up to 1,000 characters).');
  }
  const schedule = config.schedule || {};
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule) || Object.keys(schedule).length > 120 || Object.entries(schedule).some(([month,id]) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !topics.includes(id))) throw new Error('Choose a valid month and working demo for each schedule entry.');
  if (new Set(Object.values(schedule)).size !== Object.values(schedule).length) throw new Error('A demo can only be scheduled once. Choose a different demo for each month.');
  const usedDemos = config.usedDemos || [];
  const usedArticles = config.usedArticles || [];
  if (!Array.isArray(usedDemos) || usedDemos.some(id => !topics.includes(id)) || !Array.isArray(usedArticles) || usedArticles.some(id => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) throw new Error('Invalid demo history.');
  return { schedule: Object.fromEntries(Object.entries(schedule).sort()), usedDemos: [...new Set(usedDemos)], usedArticles: [...new Set(usedArticles)], version: 1, mode: config.mode, startMonth: config.startMonth, pinned: config.pinned, queue: config.queue, features: Object.fromEntries(topics.map(id => [id, Object.fromEntries(['topic', 'headline', 'explanation', 'demoTitle', 'demoDescription'].map(key => [key, config.features[id][key].trim()]))])) };
}
export async function readFeature(root = process.cwd()) {
  return validateFeature(JSON.parse(await readFile(resolve(root, 'content/homepage-feature.json'), 'utf8')));
}
export function selection(config, date = new Date()) {
  const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
  const [year, number] = config.startMonth.split('-').map(Number);
  const offset = Math.max(0, month - (year * 12 + number - 1));
  const scheduled = Object.entries(config.schedule || {}).sort().filter(([key]) => key <= date.toISOString().slice(0,7)).at(-1)?.[1];
  const id = config.mode === 'manual' ? config.pinned : scheduled || (Object.keys(config.schedule || {}).length ? config.pinned : config.queue[Math.min(offset, config.queue.length - 1)]);
  return { id, ...config.features[id] };
}
export function demonstratedDemos(config, date = new Date()) {
  const ids = [...(config.usedDemos || []), ...Object.entries(demoArticles).filter(([,slug]) => config.usedArticles?.includes(slug)).map(([id])=>id)];
  if (config.mode === 'monthly') {
    const [year, month] = config.startMonth.split('-').map(Number);
    const elapsed = date.getUTCFullYear() * 12 + date.getUTCMonth() - (year * 12 + month - 1);
    if (Object.keys(config.schedule || {}).length) {
      ids.push(config.pinned);
      ids.push(...Object.entries(config.schedule).filter(([key]) => key <= date.toISOString().slice(0,7)).map(([,id])=>id));
    } else if (elapsed >= 0) ids.push(...config.queue.slice(0, elapsed + 1));
  }
  return [...new Set(ids)];
}
export function featureDashboard(config, date = new Date()) {
  return { config, demoArticles, schedulingMonths: Array.from({length:18}, (_,i)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+i,1)).toISOString().slice(0,7)), demonstratedDemos: demonstratedDemos(config, date), current: selection(config, date), upcoming: Array.from({ length: 6 }, (_, i) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + i + 1, 1));
    const [year, month] = config.startMonth.split('-').map(Number);
    const elapsed = next.getUTCFullYear() * 12 + next.getUTCMonth() - (year * 12 + month - 1);
    return { month: next.toISOString().slice(0, 7), holding: config.mode === 'manual' || (Object.keys(config.schedule || {}).length ? !config.schedule[next.toISOString().slice(0,7)] : elapsed >= config.queue.length), ...selection(config, next) };
  }) };
}

export async function articleDemoProposals(inventory, config = {}) {
  const catalog = JSON.parse(await readFile(new URL('../../content/homepage-demo-proposals.json', import.meta.url), 'utf8'));
  if (new Set(catalog.proposals.map(item => item.articleSlug)).size !== catalog.proposals.length || new Set(catalog.proposals.map(item => item.title.trim().toLowerCase())).size !== catalog.proposals.length) throw new Error('Duplicate demo proposal. Each idea must be proposed only once.');
  const usedArticles = new Set([...(config.usedArticles || []), ...demonstratedDemos(config).map(id => demoArticles[id]).filter(Boolean)]);
  return inventory.filter(entry => entry.type === 'article' && !['draft', 'archived'].includes(entry.status))
    .map(entry => ({ articleTitle: entry.title, articlePath: entry.path,
      ...(catalog.proposals.find(proposal => proposal.articleSlug === entry.slug) || {
        articleSlug: entry.slug, status: 'needed', title: 'A fresh idea is needed',
        interaction: 'Review this article and curate a demo proposal before adding it to the rotation.', result: '', fallback: '',
      }), ...(articleDemos[entry.slug] ? { interaction: articleDemos[entry.slug].help, ...(articleDemos[entry.slug].result ? { result: articleDemos[entry.slug].result } : {}), ...(articleDemos[entry.slug].fallback ? { fallback: articleDemos[entry.slug].fallback } : {}) } : entry.slug === 'container-query-units' ? { interaction: 'Resize the card. Its headline uses cqi units and clamp() to scale with the available space.' } : {}), demoId: Object.keys(demoArticles).find(id => demoArticles[id] === entry.slug && id !== 'container-queries'), ...(Object.values(demoArticles).includes(entry.slug) ? { status: 'ready' } : {}), ...(usedArticles.has(entry.slug) ? { status: 'demonstrated' } : {}) }));
}

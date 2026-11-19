import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const topics = ['container-queries', 'fluid-type', 'aspect-ratio'];
export function validateFeature(config) {
  if (config.version !== 1 || !['monthly', 'manual'].includes(config.mode) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(config.startMonth || '') || !topics.includes(config.pinned)) throw new Error('Choose a valid rotation mode, start month and pinned topic.');
  if (!Array.isArray(config.queue) || !config.queue.length || config.queue.length > topics.length || new Set(config.queue).size !== config.queue.length || config.queue.some(id => !topics.includes(id))) throw new Error('Choose at least one unique supported topic.');
  for (const id of topics) {
    const item = config.features?.[id];
    for (const key of ['topic', 'headline', 'explanation', 'demoTitle', 'demoDescription']) if (typeof item?.[key] !== 'string' || !item[key].trim() || item[key].length > 1000) throw new Error('Each topic needs a title, headline and explanation (up to 1,000 characters).');
  }
  return { version: 1, mode: config.mode, startMonth: config.startMonth, pinned: config.pinned, queue: config.queue, features: Object.fromEntries(topics.map(id => [id, Object.fromEntries(['topic', 'headline', 'explanation', 'demoTitle', 'demoDescription'].map(key => [key, config.features[id][key].trim()]))])) };
}
export async function readFeature(root = process.cwd()) {
  return validateFeature(JSON.parse(await readFile(resolve(root, 'content/homepage-feature.json'), 'utf8')));
}
export function selection(config, date = new Date()) {
  const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
  const [year, number] = config.startMonth.split('-').map(Number);
  const offset = Math.max(0, month - (year * 12 + number - 1));
  const id = config.mode === 'manual' ? config.pinned : config.queue[offset % config.queue.length];
  return { id, ...config.features[id] };
}
export function featureDashboard(config, date = new Date()) {
  return { config, current: selection(config, date), upcoming: Array.from({ length: 6 }, (_, i) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + i + 1, 1));
    return { month: next.toISOString().slice(0, 7), ...selection(config, next) };
  }) };
}

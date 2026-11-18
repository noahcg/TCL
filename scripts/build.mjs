import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import mdnData from 'mdn-data';
import { loadContent, sourceUrl } from '../src/build/content.mjs';
import { buildEnvironment } from '../src/build/environment.mjs';
import { featuredArticle, loadArticleImages } from '../src/build/article-media.mjs';
import { loadHomeShareImage } from '../src/build/site-media.mjs';
import { articlesPage, detail, home, notFound, page, quickPage, resourcesPage, searchPage } from '../src/build/pages.mjs';

const directory = resolve('dist');
const { publishing, siteUrl } = buildEnvironment();
const analytics = publishing && process.env.VERCEL_ENV === 'production';

const loaded = await loadContent();
const images = await loadArticleImages(loaded.filter(entry => entry.type === 'article'));
const content = loaded.map(entry => entry.type === 'article' ? { ...entry, image: images.get(entry.slug) } : entry);
const byType = (type) => content.filter(record => record.type === type);
const articles = byType('article').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const quick = byType('quick-win');
const resources = byType('resource');
const defaultImage = featuredArticle(articles)?.image;
const homeShareImage = await loadHomeShareImage();

const routes = [
  { path: '/', body: home(articles), homepage: true, image: homeShareImage },
  { path: '/articles/', title: 'Articles', body: articlesPage(articles) },
  { path: '/quick-wins/', title: 'Quick Wins', body: quickPage(quick) },
  { path: '/resources/', title: 'Resources', body: resourcesPage(resources) },
  { path: '/search/', title: 'Search', body: searchPage(), noIndex: true },
  { path: null, title: 'Page not found', body: notFound(), noIndex: true },
  ...content.map(entry => ({ path: entry.path, title: entry.title, intro: entry.summary, body: detail(entry),
    image: entry.image, article: entry.type === 'article' ? entry : null })),
];

const reference = new Map();
const mdnGroups = {
  properties: 'CSS property',
  selectors: 'CSS selector',
  atRules: 'CSS at-rule',
  functions: 'CSS function',
  types: 'CSS type',
};
for (const [group, kind] of Object.entries(mdnGroups)) {
  for (const [title, entry] of Object.entries(mdnData.css[group])) {
    if (!sourceUrl(entry.mdn_url) || new URL(entry.mdn_url).hostname !== 'developer.mozilla.org' || entry.status === 'obsolete') continue;
    reference.set(title, { title, kind, syntax: entry.syntax, url: entry.mdn_url });
  }
}
const labels = { article: 'Article', 'quick-win': 'Quick Win', resource: 'Resource' };
const index = {
  content: content.map(entry => ({
    title: entry.title, type: labels[entry.type], url: entry.path, summary: entry.summary || '',
    text: [entry.searchText, ...entry.tags].join(' '),
  })),
  reference: [...reference.values()],
};

await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, 'assets'), { recursive: true });
for (const route of routes) {
  const output = route.path ? join(directory, route.path, 'index.html') : join(directory, '404.html');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, page({
    ...route, image: route.image || defaultImage, siteUrl: publishing ? siteUrl : null,
    analytics,
    robots: route.noIndex || !publishing ? 'noindex, follow' : null,
  }));
}
await cp('src/assets', join(directory, 'assets'), {
  recursive: true,
  filter: source => basename(source) !== 'articles' && basename(source) !== '.DS_Store',
});
await mkdir(join(directory, 'assets/articles'), { recursive: true });
for (const image of images.values()) {
  await copyFile(image.source, join(directory, image.path));
}
await copyFile('src/assets/favicon.ico', join(directory, 'favicon.ico'));
const fonts = [
  ['newsreader', 'newsreader-latin-wght-normal.woff2', 'newsreader.woff2'],
  ['newsreader', 'newsreader-latin-wght-italic.woff2', 'newsreader-italic.woff2'],
  ['dm-sans', 'dm-sans-latin-wght-normal.woff2', 'dm-sans.woff2'],
];
for (const [font, source, target] of fonts) {
  const root = join('node_modules', '@fontsource-variable', font);
  await copyFile(join(root, 'files', source), join(directory, 'assets', target));
  await copyFile(join(root, 'LICENSE'), join(directory, 'assets', `${font}-license.txt`));
}
await copyFile(join('node_modules', 'mdn-data', 'LICENSE'), join(directory, 'assets', 'mdn-data-license.txt'));
await copyFile(join('node_modules', '@vercel/analytics', 'dist/index.mjs'), join(directory, 'assets', 'vercel-analytics.js'));
await copyFile(join('node_modules', '@vercel/analytics', 'LICENSE'), join(directory, 'assets', 'vercel-analytics-license.txt'));
await writeFile(join(directory, 'search-index.json'), JSON.stringify(index));
if (publishing) {
  const indexed = routes.filter(route => route.path && !route.noIndex);
  const urls = indexed.map(route => `<url><loc>${new URL(route.path, siteUrl).href}</loc></url>`).join('\n');
  await writeFile(join(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}
await writeFile(join(directory, 'robots.txt'), `User-agent: *\nAllow: /\n${publishing ? `Sitemap: ${new URL('/sitemap.xml', siteUrl).href}\n` : ''}`);
console.log(`Built ${routes.length - 1} routes and a 404 page in dist/.`);

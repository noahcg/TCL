import { demoStyles } from '../src/build/article-demos.mjs';
import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import mdnData from 'mdn-data';
import { loadContent, sourceUrl } from '../src/build/content.mjs';
import { buildEnvironment } from '../src/build/environment.mjs';
import { loadArticleImages } from '../src/build/article-media.mjs';
import { loadHomeShareImage } from '../src/build/site-media.mjs';
import { articlesPage, detail, home, notFound, page, quickPage, resourcesPage, searchPage, topicsPage, topicPage } from '../src/build/pages.mjs';

import { topics, topicPath, topicEntries, seoMetadata, sitemapXml, atomFeed } from '../src/build/seo.mjs';

const directory = resolve(process.env.TCL_OUTPUT_DIRECTORY || 'dist');
const { publishing, siteUrl, gaMeasurementId } = buildEnvironment();
const analytics = publishing && process.env.VERCEL_ENV === 'production';

const loaded = await loadContent();
const images = await loadArticleImages(loaded.filter(entry => entry.type === 'article'));
const content = loaded.map(entry => entry.type === 'article' ? { ...entry, image: images.get(entry.slug) } : entry);
const byType = (type) => content.filter(record => record.type === type);
const articles = byType('article').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const quick = byType('quick-win');
const resources = byType('resource');

const homeShareImage = await loadHomeShareImage();

const labelsForBreadcrumb = type => ({article:'CSS Articles','quick-win':'CSS Quick Wins',resource:'CSS Resources'})[type];
const routes = [
  { path: '/', body: home(articles), homepage: true, image: homeShareImage },
  { path: '/articles/', title: 'Articles', body: articlesPage(articles), items:articles },
  { path: '/quick-wins/', title: 'Quick Wins', body: quickPage(quick), items:quick },
  { path: '/resources/', title: 'Resources', body: resourcesPage(resources), items:resources },
  { path:'/topics/', title:'Learn CSS by Topic', body:topicsPage(), items:topics.map(topic => ({ title:topic.title, path:topicPath(topic) })) },
  ...topics.map(topic => ({ path:topicPath(topic), title:topic.title, intro:topic.description, body:topicPage(topic,content), items:topicEntries(topic,content), breadcrumbs:[{title:'CSS Topics',path:'/topics/'},{title:topic.title,path:topicPath(topic)}] })),
  { path: '/search/', title: 'Search', body: searchPage(), noIndex: true },
  { path: null, title: 'Page not found', body: notFound(), noIndex: true },
  ...content.map(entry => ({ path: entry.path, title: entry.title, intro: entry.summary, body: detail(entry, content), entry,
    breadcrumbs:[{title:labelsForBreadcrumb(entry.type),path:`/${entry.path.split('/')[1]}/`},{title:entry.title,path:entry.path}],
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
    title: entry.title, type: labels[entry.type], url: entry.path, summary: seoMetadata(entry.path, entry.title, entry.summary, entry).description,
    text: [entry.searchText, seoMetadata(entry.path,entry.title,entry.summary,entry).title, ...entry.tags].join(' '),
  })),
  reference: [...reference.values()],
};

await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, 'assets'), { recursive: true });
for (const route of routes) {
  const output = route.path ? join(directory, route.path, 'index.html') : join(directory, '404.html');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, page({
    ...route, image: route.image || homeShareImage, siteUrl: publishing ? siteUrl : null,
    analytics, gaMeasurementId,
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
await writeFile(join(directory, 'assets/article-demos.css'), demoStyles);
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
  await writeFile(join(directory, 'sitemap.xml'), sitemapXml(routes,siteUrl));
  await writeFile(join(directory, 'feed.xml'), atomFeed(content,siteUrl));
}
await writeFile(join(directory, 'robots.txt'), `User-agent: *\nAllow: /\n${publishing ? `Sitemap: ${new URL('/sitemap.xml', siteUrl).href}\n` : ''}`);
console.log(`Built ${routes.length - 1} routes and a 404 page in dist/.`);

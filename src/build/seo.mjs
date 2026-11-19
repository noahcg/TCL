import { readFile } from 'node:fs/promises';
import { htmlText, escapeHtml as e } from './content.mjs';

export const metadata = JSON.parse(await readFile(new URL('../../content/seo/metadata.json', import.meta.url), 'utf8'));
export const topics = JSON.parse(await readFile(new URL('../../content/seo/topics.json', import.meta.url), 'utf8'));
export const topicPath = topic => `/topics/${topic.slug}/`;
export const plainText = value => htmlText(String(value || '')).replace(/`/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
const trimDescription = value => {
  const text = plainText(value);
  if (text.length <= 165) return text;
  return text.slice(0, 162).replace(/\s+\S*$/, '') + '…';
};
export function seoMetadata(path, title, intro, entry) {
  const curated = metadata[path];
  return {
    title: curated?.title || title || 'CSS Tutorials and Front-End Guides',
    description: curated?.description || trimDescription(intro || entry?.searchText || 'Practical CSS tutorials, interactive examples and front-end development resources from The Cascade Lounge.'),
  };
}
export const topicEntries = (topic, entries) => [
  ...topic.articles.map(slug => entries.find(entry => entry.type === 'article' && entry.slug === slug)),
  ...topic.quickWins.map(slug => entries.find(entry => entry.type === 'quick-win' && entry.slug === slug)),
].filter(Boolean);
export const entryTopics = entry => topics.filter(topic => topicEntries(topic, [entry]).length);

export function relatedEntries(entry, entries) {
  const groups = entryTopics(entry);
  return entries.filter(other => other.path !== entry.path && other.type !== 'resource')
    .map(other => ({ entry:other, score:groups.filter(topic => topicEntries(topic, [other]).length).length * 10
      + other.tags.filter(tag => entry.tags.includes(tag)).length }))
    .filter(other => other.score > 0).sort((a,b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))
    .slice(0, 3).map(other => other.entry);
}

// Only emit known facts; unknown authors and update dates remain absent.
export function structuredData({ path, title, description, siteUrl, image, entry, items = [], breadcrumbs = [] }) {
  if (!siteUrl || !path) return '';
  const absolute = value => new URL(value, siteUrl).href;
  const root = absolute('/');
  const url = absolute(path);
  const organization = { '@type':'Organization', '@id':`${root}#publisher`, name:'The Cascade Lounge', url:root };
  const website = { '@type':'WebSite', '@id':`${root}#website`, name:'The Cascade Lounge', url:root, inLanguage:'en', publisher:{ '@id':organization['@id'] } };
  const article = entry && ['article','quick-win'].includes(entry.type);
  const node = {
    '@type': article ? 'BlogPosting' : items.length ? 'CollectionPage' : 'WebPage',
    '@id':`${url}#webpage`, url, name:title, description, inLanguage:'en',
    isPartOf:{ '@id':website['@id'] }, publisher:{ '@id':organization['@id'] },
  };
  if (article) {
    node.headline = entry.title;
    node.mainEntityOfPage = url;
    node.articleSection = entry.type === 'article' ? 'CSS Articles' : 'CSS Quick Wins';
    node.about = entryTopics(entry).map(topic => ({ '@type':'Thing', name:topic.title, url:absolute(topicPath(topic)) }));
    if (entry.date) node.datePublished = entry.date;
    if (entry.updatedAt) node.dateModified = entry.updatedAt;
    if (entry.author) node.author = { '@type':'Person', name:entry.author };
    if (entry.image) node.image = { '@type':'ImageObject', url:absolute(entry.image.path), width:entry.image.width, height:entry.image.height };
  } else if (image) node.primaryImageOfPage = { '@type':'ImageObject', url:absolute(image.path), width:image.width, height:image.height };
  if (items.length) node.mainEntity = { '@type':'ItemList', itemListElement:items.map((item,index) => ({ '@type':'ListItem', position:index+1, name:item.title, url:absolute(item.path) })) };
  const graph = [organization,website,node];
  if (breadcrumbs.length >= 2) {
    const breadcrumb = { '@type':'BreadcrumbList', '@id':`${url}#breadcrumb`, itemListElement:breadcrumbs.map((item,index) => ({ '@type':'ListItem', position:index+1, name:item.title, item:absolute(item.path) })) };
    node.breadcrumb = { '@id':breadcrumb['@id'] };
    graph.push(breadcrumb);
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context':'https://schema.org', '@graph':graph }).replaceAll('<','\\u003c')}</script>`;
}

export function sitemapXml(routes, siteUrl) {
  const urls = routes.filter(route => route.path && !route.noIndex).map(route => {
    const modified = route.entry?.updatedAt || route.entry?.date;
    const image = route.entry?.image;
    return `<url><loc>${e(new URL(route.path,siteUrl).href)}</loc>${modified ? `<lastmod>${e(modified)}</lastmod>` : ''}${image ? `<image:image><image:loc>${e(new URL(image.path,siteUrl).href)}</image:loc></image:image>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

export function atomFeed(entries, siteUrl) {
  const articles = entries.filter(entry => ['article','quick-win'].includes(entry.type) && entry.date)
    .sort((a,b) => (b.updatedAt || b.date).localeCompare(a.updatedAt || a.date));
  const absolute = path => new URL(path,siteUrl).href;
  const timestamp = value => new Date(value).toISOString();
  const updated = articles[0] && timestamp(articles[0].updatedAt || articles[0].date);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${e(absolute('/'))}</id><title>The Cascade Lounge — CSS Tutorials</title><link href="${e(absolute('/feed.xml'))}" rel="self"/><link href="${e(absolute('/'))}"/>${updated ? `<updated>${updated}</updated>` : ''}<author><name>The Cascade Lounge</name></author>${articles.map(entry => `<entry><id>${e(absolute(entry.path))}</id><title>${e(entry.title)}</title><link href="${e(absolute(entry.path))}"/><published>${timestamp(entry.date)}</published><updated>${timestamp(entry.updatedAt || entry.date)}</updated><summary>${e(plainText(entry.summary))}</summary>${entry.author ? `<author><name>${e(entry.author)}</name></author>` : ''}</entry>`).join('')}</feed>\n`;
}

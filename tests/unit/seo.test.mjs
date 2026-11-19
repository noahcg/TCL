import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../../src/build/content.mjs';
import { page, detail, topicPage } from '../../src/build/pages.mjs';
import { metadata, topics, topicEntries, entryTopics, seoMetadata, structuredData, sitemapXml, atomFeed } from '../../src/build/seo.mjs';
const content = await loadContent();

test('curated entries have unique metadata and connected, ordered reading paths', () => {
  const titles = new Set(), descriptions = new Set();
  for (const entry of content) {
    // New Studio publications keep working with generated fallbacks before curation.
    if (!metadata[entry.path]) {
      assert(seoMetadata(entry.path,entry.title,entry.summary,entry).description);
      continue;
    }
    const seo = seoMetadata(entry.path,entry.title,entry.summary,entry);
    assert(!titles.has(seo.title)); assert(!descriptions.has(seo.description));
    assert(seo.description.length >= 80 && seo.description.length <= 200);
    assert(!/[`<>]|&#/.test(seo.description));
    titles.add(seo.title); descriptions.add(seo.description);
    if (entry.type !== 'resource') assert(entryTopics(entry).length,`Assign ${entry.path} to a topic`);
  }
  for (const topic of topics) {
    assert(topicEntries(topic,content).length >= 3);
    assert.equal(topicEntries(topic,content)[0].slug,topic.articles[0]);
    for (const slug of topic.articles) assert(content.some(entry => entry.type === 'article' && entry.slug === slug));
    for (const slug of topic.quickWins) assert(content.some(entry => entry.type === 'quick-win' && entry.slug === slug));
    assert(topicPage(topic,content).includes('class="topic-reading-list"'));
  }
});

test('article schema uses actual dates and authors and safely serializes supplied text', () => {
  const entry = content.find(entry => entry.slug === 'sibling-index');
  const markup = structuredData({path:entry.path,title:entry.title,description:'CSS </script><script>alert(1)</script>',siteUrl:'https://example.com',entry,breadcrumbs:[{title:'Articles',path:'/articles/'},{title:entry.title,path:entry.path}]});
  assert.equal((markup.match(/<\/script>/g) || []).length,1);
  const graph = JSON.parse(markup.slice(markup.indexOf('>')+1,-9))['@graph'];
  const article = graph.find(node => node['@type'] === 'BlogPosting');
  assert.equal(article.datePublished,entry.date); assert.equal(article.dateModified,entry.updatedAt);
  assert(!('author' in article));
  assert.equal(graph.find(node => node['@type'] === 'BreadcrumbList').itemListElement.length,2);
  assert(!page({path:'/search/',title:'Search',body:'',siteUrl:'https://example.com',robots:'noindex, follow'}).includes('application/ld+json'));
  assert(!page({path:'/articles/',title:'Articles',body:'',robots:'noindex, follow'}).includes('rel="canonical"'));
});

test('sitemaps exclude utility routes, preserve genuine modification dates and include article images', () => {
  const entry = {...content.find(entry => entry.slug === 'sibling-index'),image:{path:'/assets/cover.jpg'}};
  const xml = sitemapXml([{path:entry.path,entry},{path:'/search/',noIndex:true},{path:null}], 'https://example.com');
  assert(xml.includes(`<lastmod>${entry.updatedAt}</lastmod>`));
  assert(xml.includes('https://example.com/assets/cover.jpg'));
  assert(!xml.includes('/search/'));
  const unknown = sitemapXml([{path:'/resources/'}],'https://example.com');
  assert(!unknown.includes('<lastmod>'));
  const feed = atomFeed(content,'https://example.com');
  assert.equal((feed.match(/<entry>/g)||[]).length,content.filter(entry => entry.type !== 'resource').length);
});

test('new content has clean metadata fallbacks and related links never recommend the same entry', () => {
  const seo = seoMetadata('/articles/new-feature/','New CSS Feature','Use `size()` &amp; <em>containers</em>.');
  assert.equal(seo.description,'Use size() & containers.');
  for (const entry of content.filter(entry => entry.type !== 'resource')) {
    const html = detail(entry,content);
    const related = html.slice(html.indexOf('class="related-reading"'));
    assert(!related.includes(`href="${entry.path}"`));
    assert(related.includes('/topics/'));
  }
});

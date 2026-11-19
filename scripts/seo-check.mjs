import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { nodeText, walk } from '../src/build/content.mjs';

// Verify actual production output without changing the developer's local preview.
export async function checkSeo(directory, origin) {
  async function files(folder) {
    return (await Promise.all((await readdir(folder,{withFileTypes:true})).map(entry =>
      entry.isDirectory() ? files(join(folder,entry.name)) : [join(folder,entry.name)]))).flat();
  }
  const output = await files(directory);
  const pages = new Map();
  const titles = new Set();
  const descriptions = new Set();
  for (const filename of output.filter(file => file.endsWith('.html'))) {
    const path = '/' + relative(directory,filename).replaceAll('\\','/').replace(/index\.html$/,'');
    const nodes = walk(parse(await readFile(filename,'utf8')));
    const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name,attr.value]));
    const metas = new Map(nodes.filter(node => node.tagName === 'meta').map(node => [attrs(node).name || attrs(node).property,attrs(node).content]));
    const noindex = metas.get('robots')?.includes('noindex');
    const h1s = nodes.filter(node => node.tagName === 'h1');
    assert.equal(h1s.length,1,`${path}: expected one main heading`);
    const links = nodes.filter(node => node.tagName === 'a').map(node => attrs(node).href).filter(Boolean);
    const data = nodes.filter(node => node.tagName === 'script' && attrs(node).type === 'application/ld+json').map(node => JSON.parse(nodeText(node)));
    if (!noindex) {
      const title = nodeText(nodes.find(node => node.tagName === 'title'));
      const description = metas.get('description');
      assert(title && !titles.has(title),`${path}: missing or duplicate title`);
      assert(description && description.length >= 60 && description.length <= 200 && !descriptions.has(description),`${path}: missing, duplicate or unsuitable description`);
      titles.add(title); descriptions.add(description);
      const canonical = nodes.filter(node => node.tagName === 'link' && attrs(node).rel === 'canonical');
      assert.equal(canonical.length,1,`${path}: expected one canonical`);
      assert.equal(attrs(canonical[0]).href,new URL(path,origin).href,`${path}: wrong canonical`);
      assert.equal(metas.get('og:url'),new URL(path,origin).href);
      assert(metas.get('og:image')?.startsWith(origin),`${path}: missing absolute share image`);
      assert(data.length === 1 && data[0]['@graph'].some(node => ['BlogPosting','WebPage','CollectionPage'].includes(node['@type'])),`${path}: missing page schema`);
    } else assert.equal(data.length,0,`${path}: noindex page should not advertise structured data`);
    pages.set(path,{links,noindex});
  }
  for (const [path,page] of pages) {
    for (const link of page.links) {
      const url = new URL(link,new URL(path,origin));
      if (url.origin !== origin) continue;
      const target = url.pathname.endsWith('/') ? join(directory,url.pathname,'index.html') : join(directory,url.pathname);
      await access(target).catch(() => assert.fail(`${path}: broken internal link ${link}`));
    }
  }
  const reached = new Set();
  const queue = ['/'];
  while (queue.length) {
    const path = queue.shift();
    if (reached.has(path)) continue;
    reached.add(path);
    for (const href of pages.get(path)?.links || []) {
      const url = new URL(href,new URL(path,origin));
      if (url.origin === origin && pages.has(url.pathname)) queue.push(url.pathname);
    }
  }
  const sitemap = await readFile(join(directory,'sitemap.xml'),'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(new Set(urls).size,urls.length,'Duplicate sitemap URLs');
  for (const [path,page] of pages) {
    assert.equal(urls.includes(new URL(path,origin).href),!page.noindex,`${path}: sitemap indexability mismatch`);
    if (!page.noindex) assert(reached.has(path),`${path}: orphaned page`);
  }
  assert.equal(urls.length,[...pages.values()].filter(page => !page.noindex).length);
  const robots = await readFile(join(directory,'robots.txt'),'utf8');
  assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`),'Missing sitemap discovery');
  const feed = await readFile(join(directory,'feed.xml'),'utf8');
  assert(feed.includes('http://www.w3.org/2005/Atom') && feed.includes(`${origin}/articles/`),'Missing production feed');
  return { indexablePages:urls.length, noindexPages:pages.size-urls.length, orphanedPages:0, brokenInternalLinks:0, uniqueTitles:titles.size, uniqueDescriptions:descriptions.size };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const temporary = await mkdtemp(join(tmpdir(),'tcl-seo-'));
  const origin = 'https://www.thecascadelounge.com';
  try {
    execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'pipe',env:{...process.env,CONTEXT:'production',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',TCL_SITE_URL:origin,TCL_OUTPUT_DIRECTORY:temporary}});
    console.log(JSON.stringify(await checkSeo(temporary,origin),null,2));
  } finally { await rm(temporary,{recursive:true,force:true}); }
}

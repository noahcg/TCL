import { escapeHtml as e, nodeText, walk } from './content.mjs';
import { parseFragment } from 'parse5';
import { highlightCode, highlightCodeBlocks } from './highlight.mjs';
import { featuredArticle } from './article-media.mjs';

export const site = 'The Cascade Lounge';
const nav = [
  ['/articles/', 'Articles'], ['/quick-wins/', 'Quick Wins'],
  ['/resources/', 'Resources'], ['/search/', 'Search'],
];
const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const arrow = '<span aria-hidden="true">↗</span>';
const forward = '<span aria-hidden="true">→</span>';

function loungeBrand(extraClass = '', current = true) {
  return `<a class="lounge-brand${extraClass ? ` ${extraClass}` : ''}" href="/"${current ? ' aria-current="page"' : ''} aria-label="The Cascade Lounge">
    <span class="lounge-brand-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="lounge-wordmark" aria-hidden="true"><span class="lounge-wordmark-the">The</span><span class="lounge-wordmark-name">Cascade Lounge</span><span class="lounge-brand-star"></span><span class="lounge-wordmark-caption">THE CSS LOUNGE</span></span>
  </a>`;
}

const iconPaths = {
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  bookmark: '<path d="M6 3h12v19l-6-4-6 4Z"/>',
  share: '<path d="M12 15V2m-4 4 4-4 4 4M5 11H3v11h18V11h-2"/>',
  more: '<circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l5 3"/>',
  difficulty: '<path d="M4 20v-4m5 4v-8m5 8V7m5 13V2"/>',
  book: '<path d="M12 5C8 2 4 3 1 4v16c4-1 7-1 11 2 4-3 7-3 11-2V4c-3-1-7-2-11 1Zm0 0v17"/>',
  layers: '<path d="m12 1 11 6-11 6L1 7Zm-11 10 11 6 11-6M1 16l11 6 11-6"/>',
  tool: '<path d="M14 3a7 7 0 0 0-8 9L1 18a3 3 0 0 0 4 4l7-7a7 7 0 0 0 9-9l-5 5-4-4 4-5Z"/>',
  people: '<circle cx="12" cy="6" r="4"/><path d="M5 23v-5a7 7 0 0 1 14 0v5M5 4a3 3 0 0 0 0 6m14-6a3 3 0 0 1 0 6M1 21v-4a5 5 0 0 1 4-5m18 9v-4a5 5 0 0 0-4-5"/>',
};
function icon(name, className = '') {
  return `<svg${className ? ` class="${className}"` : ''} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
}

function interiorVariant(path) {
  if (!path || !/^\/(articles|quick-wins|resources)\//.test(path)) return null;
  const section = path.split('/')[1];
  return `${section === 'articles' ? 'articles' : section === 'quick-wins' ? 'quick' : 'resources'}-${path === `/${section}/` ? 'index' : 'detail'}`;
}

function masthead(path) {
  return `<header class="masthead">
    <div class="masthead-inner">
      ${loungeBrand('', path === '/')}
      <nav aria-label="Main"><ul>${nav.slice(0, 3).map(([href, label]) => `<li><a href="${href}"${path === href ? ' aria-current="page"' : path?.startsWith(href) ? ' aria-current="location"' : ''}>${label}</a></li>`).join('')}</ul></nav>
      <form class="masthead-search" role="search" aria-label="Search the Lounge" action="/search/" method="get">
        <label class="visually-hidden" for="masthead-query">Search the Lounge</label>
        <button type="submit" aria-label="Search">${icon('search')}</button>
        <input type="search" id="masthead-query" name="q" required maxlength="100" placeholder="Search the Lounge...">
      </form>
    </div>
  </header>`;
}

function footer(path) {
  return `<footer class="site-footer"><div class="footer-inner">
    ${loungeBrand('footer-brand', path === '/')}
    <p class="footer-tagline">Styles flow. Ideas spill.</p>
    <nav aria-label="Footer"><ul>${nav.map(([href, label]) => `<li><a href="${href}"${path === href ? ' aria-current="page"' : path?.startsWith(href) ? ' aria-current="location"' : ''}>${label}</a></li>`).join('')}</ul></nav>
  </div></footer>`;
}

function credit(entry) {
  const attribution = !entry.provenance && entry.attribution;
  const source = !entry.provenance && entry.source && new URL(entry.source).hostname !== 'oracleapex.com' ? entry.source : null;
  if (!attribution && !source) return '';
  return `<footer class="credit">${attribution ? `<p>${e(attribution)}</p>` : ''}${source ? `<p>Source <a href="${e(source)}">${e(new URL(source).hostname)}</a></p>` : ''}</footer>`;
}

export function page({ path, title, intro, body, siteUrl, robots, homepage = false, image, article }) {
  const metadata = title ? `${title} · ${site}` : site;
  const description = intro || 'CSS articles, practical techniques, and resources for front-end developers.';
  const url = siteUrl && path ? new URL(path, siteUrl).href : null;
  const imageUrl = siteUrl && image ? new URL(image.path, siteUrl).href : null;
  const interior = interiorVariant(path);
  const stageArt = interior && (interior === 'articles-index' ? 'articles' : interior === 'resources-index' ? 'resources' : interior.startsWith('quick') ? 'quick-win' : 'article');
  return `<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns# article: https://ogp.me/ns/article#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#172b22">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" href="/assets/favicon-32.png" sizes="32x32">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" sizes="any">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
<title>${e(metadata)}</title>
<meta name="description" content="${e(description)}">
${robots ? `<meta name="robots" content="${robots}">` : ''}
${url ? `<link rel="canonical" href="${e(url)}"><meta property="og:url" content="${e(url)}">` : ''}
<meta property="og:title" content="${e(metadata)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:site_name" content="${e(site)}">
<meta property="og:type" content="${article ? 'article' : 'website'}">
${article?.date ? `<meta property="article:published_time" content="${e(article.date)}">` : ''}
${article?.updatedAt ? `<meta property="article:modified_time" content="${e(article.updatedAt)}">` : ''}
${imageUrl ? `<meta property="og:image" content="${e(imageUrl)}">
<meta property="og:image:secure_url" content="${e(imageUrl)}">
<meta property="og:image:type" content="${e(image.type)}">
<meta property="og:image:width" content="${image.width}">
<meta property="og:image:height" content="${image.height}">
<meta property="og:image:alt" content="${e(image.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(metadata)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(imageUrl)}">
<meta name="twitter:image:alt" content="${e(image.alt)}">` : ''}
${homepage ? '<link rel="preload" as="image" href="/assets/tcl-homepage-background.webp" fetchpriority="high">' : ''}
${stageArt ? `<link rel="preload" as="image" href="/assets/tcl-${stageArt}-hero.webp" fetchpriority="high">` : ''}
${article && image ? `<link rel="preload" as="image" href="${e(image.path)}" fetchpriority="high">` : ''}
<link rel="stylesheet" href="/assets/site.css">
<script type="module" src="/assets/site.js"></script>
</head>
<body class="site-page ${homepage ? 'home-page' : interior ? `interior-page ${interior}` : 'utility-page'}">
<a class="skip" href="#main-content">Skip to content</a>
${!homepage ? '<div class="page-art" aria-hidden="true"></div>' : ''}
${masthead(path)}
<main id="main-content" tabindex="-1">${body}</main>
${footer(path)}
</body>
</html>
`;
}

function displayText(value = '') {
  const literal = String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return e(nodeText(parseFragment(literal)));
}

function dateLabel(date) {
  return date ? `<time datetime="${date}">${dateFormat.format(new Date(date))}</time>` : '';
}

function lead(title, summary, extra = '') {
  return `<header class="page-lead"><div class="shell">${extra}<h1>${e(title)}</h1>
    ${summary ? `<p>${e(summary)}</p>` : ''}</div></header>`;
}

function line(entry, external = false) {
  return `<li class="editorial-line">
    <div><h3><a href="${entry.path}">${e(entry.title)}</a></h3>${entry.summary ? `<p>${displayText(entry.summary)}</p>` : ''}</div>
    <div class="line-meta">${dateLabel(entry.date)}${entry.difficulty ? `<span>${e(entry.difficulty)}</span>` : ''}${external ? `<a href="${e(entry.url)}" aria-label="Visit ${e(entry.title)}">Visit site ${arrow}</a>` : ''}</div>
  </li>`;
}

export function home(entries) {
  const destinations = [
    { id: 'articles', title: 'Articles', description: 'In-depth guides on modern CSS techniques, patterns, and workflows.', path: '/articles/', icon: '<path d="m24 5 19 10-19 10L5 15Z M5 23l19 10 19-10 M5 31l19 10 19-10"/>' },
    { id: 'quick-wins', title: 'Quick Wins', description: 'Practical, bite-sized CSS tips you can use right away.', path: '/quick-wins/', icon: '<path class="home-bolt" d="m29 3-20 24h13l-4 18 21-26H26Z"/>' },
    { id: 'resources', title: 'Resources', description: 'Trusted references, tools, and links worth keeping close.', path: '/resources/', icon: '<path d="M24 10C17 5 10 6 4 8v30c7-2 13-2 20 3 7-5 13-5 20-3V8c-6-2-13-3-20 2Zm0 0v31"/>' },
  ];
  return `<div class="home-composition">
    <div class="home-first-screen">
    <section class="home-intro" aria-labelledby="home-title">
      <p class="home-kicker">Welcome to</p>
      <h1 id="home-title">The Cascade <em>Lounge</em></h1>
      <p class="home-description">The place to gather for the latest in CSS — where styles flow and ideas spill.</p>
      <div class="home-actions">
        ${entries[0] ? `<a class="home-button home-button-primary" href="${e(entries[0].path)}">Read the latest ${forward}</a>` : ''}
        <a class="home-button home-button-secondary" href="/articles/">Browse articles</a>
      </div>
    </section>
    <a class="home-scroll-cue" href="#home-destinations" aria-label="Explore the Lounge below"><svg viewBox="0 0 24 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v24m-7-7 7 7 7-7"/></svg></a>
    </div>
    <nav class="home-destinations" id="home-destinations" tabindex="-1" aria-label="Explore the Lounge">
      ${destinations.map(item => `<a class="home-card home-card-${item.id}" href="${item.path}" aria-labelledby="home-${item.id}-title" aria-describedby="home-${item.id}-description">
        <span class="home-card-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round">${item.icon}</svg></span>
        <div class="home-card-copy"><h2 id="home-${item.id}-title">${item.title}</h2><p id="home-${item.id}-description">${item.description}</p></div>
        <svg class="home-card-arrow" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h17m-7-7 7 7-7 7"/></svg>
      </a>`).join('')}
    </nav>
  </div>`;
}

const articleDisplay = {
  'container-query-units': {
    category: 'Layout',
    deck: 'The missing half of component-responsive CSS.',
    lede: 'Container query units (CQ units) let components respond to the size of their container, not the viewport. They’re a powerful addition to modern CSS, and they open up new, more predictable layout patterns.',
  },
  'modern-resets': { category: 'Styling', deck: 'A practical approach to cleaner, more predictable foundations.' },
};

function readingTime(entry) {
  if (Number.isFinite(entry.readingMinutes) && entry.readingMinutes > 0) return `<span class="reading-time">${e(entry.readingMinutes)} min read</span>`;
  if (typeof entry.readingTime === 'string' && entry.readingTime.trim()) return `<span class="reading-time">${e(entry.readingTime)}</span>`;
  const words = (entry.searchText || nodeText(parseFragment(entry.html || ''))).trim().split(/\s+/).filter(Boolean).length;
  return `<span class="reading-time" title="Estimated at 200 words per minute">Est. ${Math.max(1, Math.ceil(words / 200))} min read</span>`;
}

function interiorLead(kicker, title, deck, extraClass = '', titleHTML = '') {
  return `<header class="interior-lead ${extraClass}"><div class="interior-lead-copy">
    <p class="interior-kicker">${e(kicker)}</p><h1>${titleHTML || e(title)}</h1><p class="interior-deck">${e(deck)}</p>
  </div></header>`;
}

export function articlesPage(entries) {
  const featured = featuredArticle(entries);
  const rest = entries.filter(entry => entry !== featured);
  const reset = rest.find(entry => entry.slug === 'modern-resets');
  const ordered = reset ? [reset, ...rest.filter(entry => entry !== reset)] : rest;
  const display = articleDisplay[featured?.slug] || {};
  return `${interiorLead('Articles', 'In-depth CSS for real-world builders.', 'Guides, deep dives, and thoughtful explorations of modern CSS.', 'archive-lead', 'In-depth CSS for <span class="title-phrase">real-world builders.</span>')}
  <div class="interior-paper archive-sheet">
    ${featured ? `<a class="archive-feature${featured.image ? '' : ' without-thumbnail'}" href="${featured.path}" aria-labelledby="archive-feature-title">
      ${featured.image ? `<img src="${e(featured.image.path)}" width="${featured.image.width}" height="${featured.image.height}" alt="${e(featured.image.alt)}" fetchpriority="high">` : ''}
      <div class="archive-feature-copy"><p class="interior-eyebrow">Featured</p><h2 id="archive-feature-title">${e(featured.title)}</h2><p class="archive-feature-deck">${e(display.deck || featured.summary || '')}</p><div class="entry-meta">${dateLabel(featured.date)}<span aria-hidden="true">·</span>${readingTime(featured)}</div></div>
      <span class="circle-arrow">${icon('arrow')}</span>
    </a>` : ''}
    <section class="archive-list" aria-label="All articles"><ul>${ordered.map(entry => {
      const presentation = articleDisplay[entry.slug] || {};
      return `<li><a class="archive-row" href="${entry.path}" aria-labelledby="archive-${entry.slug}">
        <div>${presentation.category ? `<p class="interior-eyebrow">${e(presentation.category)}</p>` : ''}<h2 id="archive-${entry.slug}">${e(entry.title)}</h2>${presentation.deck || entry.summary ? `<p>${e(presentation.deck || entry.summary)}</p>` : ''}</div>
        <div class="entry-meta">${dateLabel(entry.date)}<span aria-hidden="true">·</span>${readingTime(entry)}</div>${icon('arrow', 'row-arrow')}
      </a></li>`;
    }).join('')}</ul></section>
  </div>`;
}

export function quickPage(entries) {
  const tags = [...new Set(entries.flatMap(item => item.tags))].sort();
  return `${interiorLead('Quick Wins', 'Quick Wins', 'Small CSS techniques you can use in your next project.', 'quick-index-lead')}
    <div class="interior-paper"><div class="shell sections section-list">
      ${tags.length ? `<form class="topic-filter" hidden><label for="quick-topic">Filter by topic</label><select id="quick-topic" name="topic"><option value="">All topics</option>${tags.map(tag => `<option value="${e(tag)}">${e(tag)}</option>`).join('')}</select><p class="status" role="status"></p></form>` : ''}
      <ul class="quick-list">${entries.map(entry => `<li data-topics="${e(JSON.stringify(entry.tags))}"><article>
        <div class="quick-heading"><h2><a href="${entry.path}">${e(entry.title)}</a></h2>${dateLabel(entry.date)}</div>
        <p>${displayText(entry.summary || '')}</p>${entry.code ? codeControls(`<pre><code>${e(entry.code)}</code></pre>`) : ''}
        ${entry.note ? `<p>${displayText(entry.note)}</p>` : ''}
        <p class="metadata">${e([...entry.tags, entry.difficulty].filter(Boolean).join(' · '))}</p>
      </article></li>`).join('')}</ul>
    </div></div>`;
}

const resourceCategories = [
  { id: 'documentation', title: 'Documentation', description: 'Authoritative references and specifications.', icon: 'book' },
  { id: 'tools', title: 'Tools', description: 'Useful utilities for CSS development.', icon: 'tool' },
  { id: 'patterns', title: 'Patterns', description: 'Practical, real-world CSS pattern libraries.', icon: 'layers' },
  { id: 'community', title: 'Community', description: 'Places to learn, share, and stay current.', icon: 'people' },
];

export function resourcesPage(entries) {
  const groups = new Map(resourceCategories.map(category => [category.id, []]));
  for (const entry of entries) {
    const category = entry.slug === 'mdn-web-docs' ? 'documentation' : entry.slug === 'css-tricks' ? 'patterns' : entry.kind === 'Tool' ? 'tools' : 'community';
    groups.get(category).push(entry);
  }
  return `${interiorLead('Resources', 'Trusted CSS resources in one place.', 'Documentation, reference sites, tools, and more — handpicked for modern front-end work.', 'resources-lead', 'Trusted CSS resources <span class="title-phrase">in one place.</span>')}
    <div class="interior-paper resource-paper">
      <nav class="resource-categories" aria-label="Resource categories">${resourceCategories.map(category => `<a class="resource-card resource-card-${category.id}" href="#${category.id}" aria-labelledby="category-${category.id}" aria-describedby="category-${category.id}-description">
        <span class="resource-icon" aria-hidden="true">${icon(category.icon)}</span><h2 id="category-${category.id}">${category.title}</h2><p id="category-${category.id}-description">${category.description}</p><span class="circle-arrow">${icon('arrow')}</span>
      </a>`).join('')}</nav>
      <div class="shell sections resource-sections">${resourceCategories.map(category => `<section class="section-list" id="${category.id}" aria-labelledby="resource-${category.id}">
        <div class="section-heading"><h2 id="resource-${category.id}">${category.title}</h2></div>
        <ul class="editorial-list">${groups.get(category.id).map(entry => line(entry, true)).join('')}${category.id === 'tools' && !groups.get('tools').length ? `<li class="editorial-line"><div><h3><a href="https://developer.chrome.com/docs/devtools/css/">Chrome DevTools CSS guide</a></h3><p>Official documentation · developer.chrome.com</p></div><span aria-hidden="true">↗</span></li>` : ''}</ul>
      </section>`).join('')}</div>
    </div>`;
}

function codeControls(html) {
  return highlightCodeBlocks(html).replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, block => {
    const pre = block.replace(/^<pre\b([^>]*)>/i, '<pre tabindex="0"$1>');
    return `<div class="code-block"><div class="code-toolbar"><button type="button" class="copy" hidden>Copy code</button></div>${pre}</div>`;
  });
}

function outline(html) {
  const headings = walk(parseFragment(html)).filter(node => node.tagName === 'h2');
  const names = [];
  const ids = new Set(walk(parseFragment(html)).flatMap(node => (node.attrs ?? []).filter(attr => attr.name === 'id').map(attr => attr.value)));
  const updated = html.replace(/<h2\b([^>]*)>/gi, (match, attrs) => {
    const heading = headings[names.length];
    if (!heading) return match;
    const title = nodeText(heading).trim();
    const original = heading.attrs.find(attr => attr.name === 'id')?.value
      || (heading.parentNode.tagName === 'section' && heading.parentNode.attrs.find(attr => attr.name === 'id')?.value);
    let id = original || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const base = id;
    let suffix = 2;
    while (!original && ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    names.push({ id, title });
    return original ? match : `<h2${attrs} id="${e(id)}">`;
  });
  return { html: updated, names };
}

function articleActions(entry) {
  return `<div class="article-actions" data-article-url="${e(entry.path)}" hidden>
    <button type="button" data-article-action="bookmark" aria-label="Bookmark article" aria-pressed="false">${icon('bookmark')}</button>
    <button type="button" class="round-action" data-article-action="share" aria-label="Share article">${icon('share')}</button>
    <details class="article-more"><summary class="round-action" aria-label="More article actions">${icon('more')}</summary><div class="article-action-menu"><button type="button" data-article-action="copy">Copy link</button><button type="button" data-article-action="print">Print</button></div></details>
    <p class="article-actions-status" role="status"></p>
  </div>`;
}

function articleHero(entry) {
  const display = articleDisplay[entry.slug] || {};
  return `<header class="interior-article-lead${entry.image ? ' has-cover' : ''}">
    <nav class="article-breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/articles/">Articles</a></li>${display.category ? `<li>${e(display.category)}</li>` : ''}<li aria-current="location">${e(entry.title)}</li></ol></nav>
    <div class="article-hero-grid">
      <div class="article-hero-copy">${display.category ? `<p class="article-category">${e(display.category)}</p>` : ''}
        <h1 id="article-title">${e(entry.title)}</h1>
        ${display.deck || entry.summary ? `<p class="interior-deck">${e(display.deck || entry.summary)}</p>` : ''}
        <div class="article-hero-meta"><div class="entry-meta">${entry.author ? `<span>By ${e(entry.author)}</span>` : ''}${dateLabel(entry.date)}<span aria-hidden="true">·</span>${readingTime(entry)}${entry.updatedAt ? `<span>Updated ${dateLabel(new Date(entry.updatedAt).toISOString().slice(0, 10))}</span>` : ''}</div>${articleActions(entry)}</div>
      </div>
      ${entry.image ? `<img class="article-cover" src="${e(entry.image.path)}" width="${entry.image.width}" height="${entry.image.height}" alt="${e(entry.image.alt)}" fetchpriority="high">` : ''}
    </div>
  </header>`;
}

function quickHero(entry) {
  return `<header class="interior-quick-lead"><div class="interior-lead-copy">
    <p class="interior-kicker">Quick Win</p><h1 id="article-title">${e(entry.title)}</h1>
    ${entry.summary ? `<p class="interior-deck">${displayText(entry.summary)}</p>` : ''}
    <div class="quick-hero-meta"><span>${icon('clock')}${readingTime(entry)}</span>${entry.difficulty ? `<span>${icon('difficulty')}${e(entry.difficulty[0].toUpperCase() + entry.difficulty.slice(1))}</span>` : ''}</div>
  </div></header>`;
}

function quickShowcase() {
  return `<section class="quick-showcase" aria-labelledby="quick-idea">
    <div class="quick-idea"><h2 id="quick-idea">The idea</h2><p>Use CSS scroll snap to create a clean, aligned slideshow — no JavaScript required.</p></div>
    <div class="code-block showcase-code"><div class="code-toolbar"><span class="code-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="code-language">CSS</span><button class="copy code-copy-icon" type="button" aria-label="Copy code" hidden>${icon('copy')}</button></div><pre tabindex="0">${highlightCode('.container {\n  scroll-snap-type: x mandatory;\n  overflow-x: auto;\n  display: flex;\n  gap: 1rem;\n}')}</pre></div>
  </section>`;
}

export function detail(entry) {
  const section = entry.type === 'article' ? 'Articles' : entry.type === 'quick-win' ? 'Quick Wins' : 'Resources';
  const back = `/${entry.path.split('/')[1]}/`;
  const raw = entry.type === 'resource' ? entry.html.replace(/<h3\b[^>]*>[\s\S]*?<\/h3>/, '') : entry.html;
  const { html, names } = outline(raw.replace('<button type="button" id="toggle">', '<button type="button" id="toggle" hidden>'));
  const contents = entry.type === 'article' && names.length > 2;
  const meta = [
    entry.author && `<span>By ${e(entry.author)}</span>`,
    dateLabel(entry.date),
    entry.updatedAt && `<span>Updated ${dateLabel(new Date(entry.updatedAt).toISOString().slice(0, 10))}</span>`,
    entry.difficulty && `<span>${e(entry.difficulty)}</span>`,
  ].filter(Boolean).join('');
  const display = articleDisplay[entry.slug] || {};
  const showcase = entry.type === 'quick-win' && entry.slug === 'simplify-slideshows-with-scroll-snap';
  return `<article class="detail">
    ${entry.type === 'article' ? articleHero(entry) : entry.type === 'quick-win' ? quickHero(entry) : `<header class="article-lead"><div class="shell">
      <a class="back-link" href="${back}"><span aria-hidden="true">←</span> ${section}</a>
      <h1 id="article-title">${e(entry.title)}</h1>
      ${entry.summary && entry.type !== 'resource' ? `<p class="dek">${displayText(entry.summary)}</p>` : ''}
      ${meta ? `<div class="article-meta">${meta}</div>` : ''}
    </div></header>`}
    <div class="interior-paper">
      ${showcase ? quickShowcase() : ''}
    <div class="shell article-layout${contents ? ' with-contents' : ''}">
      ${contents ? `<nav class="contents" aria-label="On this page"><details open>
        <summary id="contents-title"><span class="contents-eyebrow">Reading guide</span><span class="contents-heading">On this page</span><span class="contents-toggle" aria-hidden="true">${icon('arrow')}</span></summary>
        <div class="contents-meta"><span>${names.length} sections</span><span class="contents-progress" aria-hidden="true">01 / ${String(names.length).padStart(2, '0')}</span></div>
        <ul>${names.map((item, index) => `<li><a href="#${e(encodeURIComponent(item.id))}"><span class="contents-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span>${e(item.title)}</span></a></li>`).join('')}</ul>
        <a class="contents-top" href="#article-title">Back to article <span aria-hidden="true">↑</span></a>
      </details></nav>` : ''}
      <div class="prose">
        ${entry.type === 'article' && display.lede ? `<div class="article-opening"><p>${e(display.lede)}</p></div>` : ''}
        ${entry.type === 'quick-win' ? `<p class="quick-published">Published ${dateLabel(entry.date)}</p>` : ''}
        ${codeControls(html).replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, table => `<div class="table-scroll" tabindex="0" role="region" aria-label="Article table">${table}</div>`)}
        ${entry.url ? `<p><a class="text-link" href="${e(entry.url)}">Visit ${e(entry.title)} ${arrow}</a></p>` : ''}
        ${credit(entry)}
      </div>
    </div></div>
  </article>`;
}

export function searchPage() {
  return `${lead('Search', 'Find an article, a Quick Win, a resource, or a CSS term.')}
    <div class="interior-paper"><div class="shell sections search-layout">
      <form class="search-form" role="search" aria-label="Search CSS" action="/search/" method="get">
        <label for="query">Search CSS</label>
        <div><input type="search" name="q" id="query" maxlength="100" placeholder="Try subgrid or @layer" required><button type="submit" class="button">Search</button></div>
      </form>
      <p id="search-status" class="status" role="status"></p>
      <div id="search-results"></div>
      <noscript><p>Search uses JavaScript. Browse <a href="/articles/">Articles</a>, <a href="/quick-wins/">Quick Wins</a>, <a href="/resources/">Resources</a>, or the <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference">MDN CSS reference</a>.</p></noscript>
    </div></div>`;
}

export function notFound() {
  return `${lead('Page not found', 'This address doesn’t lead to a page in The Cascade Lounge.')}
    <div class="interior-paper"><div class="shell sections"><a class="text-link" href="/articles/">Browse articles ${forward}</a></div></div>`;
}

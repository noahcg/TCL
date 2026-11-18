import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { marked } from 'marked';
import { parseFragment } from 'parse5';
import sanitize from 'sanitize-html';

export const snapshotFile = new URL('../../content/imported/watercooler/published.json', import.meta.url);
const authoredFolder = new URL('../../content/authored/', import.meta.url);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const collections = { article: 'articles', 'quick-win': 'quick-wins', resource: 'resources' };
const articleStatus = new Set(['draft', 'published', 'archived']);

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function canonicalJson(value) {
  return JSON.stringify(value, (_, entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]));
  });
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function walk(node) {
  return (node.childNodes ?? []).flatMap(child => [child, ...walk(child)]);
}

export function nodeText(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(nodeText).join('');
}

export function htmlText(html) {
  return walk(parseFragment(html)).filter(node => node.nodeName === '#text').map(node => node.value)
    .join(' ').replace(/\s+/g, ' ').trim();
}

function signature(html) {
  const nodes = walk(parseFragment(html));
  return {
    code: nodes.filter(node => node.tagName === 'pre').map(nodeText),
    ids: nodes.flatMap(node => (node.attrs ?? []).filter(attr => attr.name === 'id').map(attr => attr.value)),
  };
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function apexDate(value) {
  const parts = /^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(value);
  assert(parts, 'Unexpected date in APEX archive');
  return `${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

function isText(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function slugify(value) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function sourceUrl(value) {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && ![...url.searchParams.keys()].some(key => /^(session|cs|token|access_token|api_key)$/i.test(key));
  } catch {
    return false;
  }
}

function cleanHtml(html, article) {
  return sanitize(html, {
    allowedTags: [...sanitize.defaults.allowedTags, 'button', 'caption', 'figure', 'figcaption', 'img',
      'mark', 'time', 'details', 'summary', 'samp', 'var', 'abbr', 'del', 'ins'],
    allowedAttributes: {
      '*': ['id', 'class', 'lang', 'dir', 'title'],
      a: ['href'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
      button: ['type'],
      div: ['data-state'],
      time: ['datetime'],
      td: ['colspan', 'rowspan', 'headers'],
      th: ['scope', 'colspan', 'rowspan', 'headers'],
    },
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    exclusiveFilter: frame => frame.tag === 'button'
      && !(article.slug === 'transition-behavior' && frame.attribs.id === 'toggle'),
  });
}

function prepareBody(entry) {
  const context = entry.slug;
  assert(isText(entry.body), `${context}: missing body`);
  const formatted = entry.format === 'markdown'
    ? marked.parse(entry.body)
    : entry.format === 'text'
      ? `<div class="plain-text">${escapeHtml(entry.body)}</div>`
      : entry.body;
  const clean = cleanHtml(formatted, entry);
  const before = signature(formatted);
  const after = signature(clean);
  assert(JSON.stringify(before.code) === JSON.stringify(after.code), `${context}: code changed during rendering`);
  assert(JSON.stringify(before.ids) === JSON.stringify(after.ids), `${context}: heading or element IDs changed during rendering`);
  assert(htmlText(formatted) === htmlText(clean), `${context}: visible text changed during rendering`);
  assert(new Set(after.ids).size === after.ids.length && !after.ids.some(id => ['main-content', 'article-title', 'contents-title'].includes(id)),
    `${context}: duplicate or reserved element IDs`);
  return clean;
}

function checkedRecord(input) {
  const { type, slug, status, title, summary, date, updatedAt, tags = [], author, attribution, source, format = 'html' } = input;
  assert(collections[type] && typeof slug === 'string' && slugPattern.test(slug) && slug.length <= 140, 'Record requires a supported type and URL slug');
  assert(articleStatus.has(status) && isText(title), `${slug}: missing status or title`);
  assert(summary == null || typeof summary === 'string', `${slug}: invalid summary`);
  assert(date == null || validDate(date), `${slug}: invalid publication date`);
  assert(updatedAt == null || (isText(updatedAt) && !Number.isNaN(Date.parse(updatedAt))), `${slug}: invalid update date`);
  assert(Array.isArray(tags) && tags.every(isText), `${slug}: invalid tags`);
  assert(author == null || isText(author), `${slug}: invalid author`);
  assert(attribution == null || isText(attribution), `${slug}: invalid attribution`);
  assert(source == null || sourceUrl(source), `${slug}: invalid source URL`);
  assert(['markdown', 'html', 'text'].includes(format), `${slug}: invalid body format`);
  const entry = { ...input, tags, format, path: `/${collections[type]}/${slug}/` };
  if (type === 'resource') assert(sourceUrl(entry.url), `${slug}: invalid resource link`);
  const html = prepareBody(entry);
  return { ...entry, html, searchText: htmlText(html), codeBlocks: signature(html).code.length };
}

function inspectCapture(bundle) {
  assert(bundle && ['public-apex-rendered-dom', 'oracle-article-export'].includes(bundle.method), 'Unknown migration source');
  assert(Object.keys(bundle).every(key => ['source', 'method', 'capturedOn', 'articles', 'quick', 'resources'].includes(key)),
    'Unknown envelope field or private archive. Provide the published candidate.');
  assert(sourceUrl(bundle.source) && bundle.source.endsWith('/') && !new URL(bundle.source).search && !new URL(bundle.source).hash
    && validDate(bundle.capturedOn), 'Snapshot is missing source provenance');
  assert(Array.isArray(bundle.articles) && bundle.articles.length > 0, 'The article export is empty');
  assert(Array.isArray(bundle.quick) && Array.isArray(bundle.resources), 'Missing supporting inventory');
  const oracle = bundle.method === 'oracle-article-export';
  const sourceIds = new Set();
  const articles = bundle.articles.map(row => {
    assert(typeof row.slug === 'string' && isText(row.body), 'Article missing slug or body');
    if (oracle) {
      const publicFields = ['sourceId', 'slug', 'title', 'summary', 'author', 'attribution', 'date', 'updatedAt',
        'status', 'format', 'body', 'oracleBodyUnits', 'utf8Bytes', 'sha256', 'tags'];
      assert(Object.keys(row).every(field => publicFields.includes(field)), `${row.slug}: unexpected Oracle export metadata`);
      assert(isText(row.sourceId) && !sourceIds.has(row.sourceId), `${row.slug}: missing or duplicate source ID`);
      sourceIds.add(row.sourceId);
      assert(row.sha256 === sha256(row.body) && row.utf8Bytes === Buffer.byteLength(row.body), `${row.slug}: Oracle body checksum mismatch`);
      assert(row.status === 'published', `${row.slug}: the public bundle may only contain published articles`);
      assert(row.format === 'html' || row.format === 'text' || row.format === 'markdown', `${row.slug}: source format missing`);
    } else {
      const actual = signature(row.body);
      assert(row.heading === row.title && row.meta?.[0]?.[2] === row.title && row.meta?.[1]?.[2] === row.summary,
        `${row.slug}: archive and detail metadata differ`);
      assert(JSON.stringify(row.code) === JSON.stringify(actual.code), `${row.slug}: browser code blocks differ`);
      assert(JSON.stringify(row.ids) === JSON.stringify(actual.ids), `${row.slug}: browser IDs differ`);
    }
    return checkedRecord({
      ...row, type: 'article', status: 'published', date: oracle ? row.date : apexDate(row.date),
      source: `${bundle.source}articles`, provenance: bundle.method,
    });
  });
  const quickWins = bundle.quick.map(row => {
    assert(isText(row.title) && isText(row.code) && validDate(row.date), 'Quick Win missing title, code or date');
    const raw = signature(row.html);
    assert(raw.code.length === 1 && raw.code[0] === row.code, `${row.title}: snippet content differs`);
    return checkedRecord({
      ...row, slug: row.slug ?? slugify(row.title), type: 'quick-win', status: 'published',
      body: row.html.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/, '').replace(/<time\b[^>]*>[\s\S]*?<\/time>/, ''),
      source: `${bundle.source}quick-wins`, provenance: 'public-apex-rendered-dom',
    });
  });
  const resources = bundle.resources.map(row => {
    assert(isText(row.title) && sourceUrl(row.url), 'Resource missing name or link');
    const nodes = walk(parseFragment(row.html));
    const link = nodes.find(node => node.tagName === 'a');
    const rawUrl = link?.attrs.find(attribute => attribute.name === 'href')?.value;
    assert(sourceUrl(rawUrl) && new URL(rawUrl).href === row.url, `${row.title}: resource link differs`);
    const findText = suffix => nodes.find(node => node.attrs?.some(attr => attr.name === 'class' && attr.value.endsWith(suffix)));
    const summary = findText('__summary');
    return checkedRecord({
      ...row, slug: row.slug ?? slugify(row.title), type: 'resource', status: 'published',
      summary: summary ? nodeText(summary).trim() : null, body: row.html,
      source: `${bundle.source}resources`, provenance: 'public-apex-rendered-dom',
    });
  });
  return [...articles, ...quickWins, ...resources];
}

function comparePaths(records) {
  assert(new Set(records.map(row => row.path)).size === records.length, 'Duplicate content route. Resolve its slug before importing.');
}

export function validateSnapshot(bundle, requireSeal = true) {
  const { integrity, ...payload } = bundle;
  const seal = sha256(canonicalJson(payload));
  if (requireSeal || integrity !== undefined) {
    assert(integrity === seal, 'Snapshot integrity check failed');
  }
  const records = inspectCapture(payload);
  comparePaths(records);
  return { records, seal, payload };
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, symbol => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[symbol]);
}

export async function loadContent(bundle = null) {
  bundle ??= JSON.parse(await readFile(snapshotFile, 'utf8'));
  const { records } = validateSnapshot(bundle);

  for (const filename of (await readdir(authoredFolder)).filter(name => name.endsWith('.json')).sort()) {
    records.push(checkedRecord(JSON.parse(await readFile(new URL(filename, authoredFolder), 'utf8'))));
  }
  comparePaths(records);
  return records.filter(record => record.status === 'published');
}

for (const button of document.querySelectorAll('.copy')) {
  if (!navigator.clipboard?.writeText) continue;
  const announcement = document.createElement('span');
  announcement.className = 'copy-feedback';
  announcement.setAttribute('role', 'status');
  button.before(announcement);
  button.hidden = false;
  let reset;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.closest('.code-block').querySelector('pre').textContent);
      announcement.textContent = 'Copied.';
      clearTimeout(reset);
      reset = setTimeout(() => { announcement.textContent = ''; }, 2400);
    } catch {
      announcement.textContent = 'Select the code to copy it manually.';
    }
  });
}

const contents = document.querySelector('.contents');
if (contents) {
  const toc = contents.querySelector('details');
  const desktop = matchMedia('(min-width: 64rem)');
  const links = [...contents.querySelectorAll('ul a')];
  const targets = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
  const progress = contents.querySelector('.contents-progress');
  let current = -1;
  const setCurrent = index => {
    if (index === current) return;
    current = index;
    links.forEach((link, item) => {
      if (item === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (progress) progress.textContent = `${String(index + 1).padStart(2, '0')} / ${String(links.length).padStart(2, '0')}`;
  };
  const updateCurrent = () => {
    const threshold = Math.max(96, innerHeight * .22);
    let index = 0;
    targets.forEach((target, item) => {
      if (target && target.getBoundingClientRect().top <= threshold) index = item;
    });
    setCurrent(index);
  };
  const layout = () => { toc.open = desktop.matches; updateCurrent(); };
  layout();
  desktop.addEventListener('change', layout);
  links.forEach((link, index) => link.addEventListener('click', () => setCurrent(index)));
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; updateCurrent(); });
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', schedule);
  addEventListener('load', schedule, { once: true });
  document.fonts.ready.then(schedule);
}

const demo = document.querySelector('.demo-wrap #toggle');
const panel = document.querySelector('.demo-wrap #panel');
if (demo && panel) {
  demo.hidden = false;
  demo.setAttribute('aria-controls', panel.id);
  const setDemo = open => {
    panel.dataset.state = open ? 'open' : 'closed';
    demo.setAttribute('aria-expanded', String(open));
    demo.textContent = open ? 'Close panel' : 'Open panel';
  };
  setDemo(panel.dataset.state === 'open');
  demo.addEventListener('click', () => setDemo(panel.dataset.state !== 'open'));
}

const topics = document.querySelector('.topic-filter');
if (topics) {
  const choices = [...topics.querySelectorAll('input[name="topic"]')];
  const query = topics.elements.q;
  const entries = [...document.querySelectorAll('[data-topics]')];
  const empty = document.querySelector('.quick-empty');
  const filter = (updateURL = false) => {
    const selected = choices.find(input => input.checked)?.value || '';
    const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of entries) {
      const matches = (!selected || JSON.parse(item.dataset.topics).includes(selected))
        && words.every(word => item.dataset.quickSearch.toLowerCase().includes(word));
      item.hidden = !matches;
      if (matches) shown++;
    }
    topics.querySelector('.status').textContent = `${shown} of ${entries.length} ${shown === 1 ? 'Quick Win' : 'Quick Wins'}`;
    empty.hidden = shown > 0;
    if (updateURL) {
      const url = new URL(window.location.href);
      if (selected) url.searchParams.set('topic', selected);
      else url.searchParams.delete('topic');
      if (query.value.trim()) url.searchParams.set('q', query.value.trim());
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
  };
  const readURL = () => {
    const params = new URLSearchParams(location.search);
    const selected = choices.find(input => input.value === params.get('topic')) || choices[0];
    selected.checked = true;
    query.value = (params.get('q') || '').slice(0, 100);
    filter();
  };
  readURL();
  topics.hidden = false;
  choices.forEach(input => input.addEventListener('change', () => filter(true)));
  query.addEventListener('input', () => filter(true));
  topics.addEventListener('submit', event => { event.preventDefault(); filter(true); });
  addEventListener('popstate', readURL);
  document.querySelector('[data-clear-quick]').addEventListener('click', () => {
    topics.reset();
    query.value = '';
    filter(true);
    query.focus();
  });
}

for (const checkbox of document.querySelectorAll('[data-quick-has]')) {
  const target = document.getElementById(checkbox.dataset.quickHas);
  checkbox.closest('label').hidden = false;
  checkbox.addEventListener('change', () => {
    target.querySelector('img')?.remove();
    if (checkbox.checked) {
      const image = document.createElement('img');
      image.src = '/assets/favicon.svg';
      image.alt = '';
      target.prepend(image);
    }
    target.querySelector('span').textContent = checkbox.checked ? 'Now with an image' : 'A simple card';
  });
}

const searchForm = document.querySelector('.search-form');
if (searchForm) {
  const query = (new URLSearchParams(location.search).get('q') ?? '').slice(0, 100).trim();
  searchForm.elements.q.value = query;
  const mastheadQuery = document.querySelector('.masthead-search input');
  if (mastheadQuery) mastheadQuery.value = query;
  searchForm.addEventListener('submit', event => {
    if (searchForm.elements.q.value.trim()) return;
    event.preventDefault();
    searchForm.elements.q.value = '';
    searchForm.elements.q.reportValidity();
  });
  if (query) showResults(query);
}

async function showResults(query) {
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  status.textContent = 'Searching…';
  try {
    const response = await fetch('/search-index.json');
    if (!response.ok) throw new Error('Search unavailable');
    const index = await response.json();
    const needle = normalize(query);
    const words = needle.split(/\s+/);
    const match = value => words.every(word => normalize(value).includes(word));
    const score = item => normalize(item.title) === needle ? 10 : match(item.title) ? 7 : match(item.summary) ? 4 : 1;
    const internal = index.content.filter(item => match(`${item.title} ${item.summary} ${item.text}`))
      .sort((a, b) => score(b) - score(a)).slice(0, 30);
    const reference = index.reference.filter(item => match(item.title))
      .sort((a, b) => score(b) - score(a)).slice(0, 8);
    const total = internal.length + reference.length;
    status.textContent = total ? `${total} results for “${query}”.` : `No results for “${query}”.`;
    if (internal.length) results.append(resultGroup('From The Cascade Lounge', internal, false));
    if (reference.length) results.append(resultGroup('CSS reference · MDN', reference, true));
  } catch {
    status.textContent = 'Search is temporarily unavailable.';
  }
  const paragraph = document.createElement('p');
  const mdn = document.createElement('a');
  mdn.href = `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query + ' CSS')}`;
  mdn.textContent = 'Search MDN Web Docs';
  paragraph.append(mdn);
  results.append(paragraph);
}

function normalize(text) {
  return text.normalize('NFKC').toLowerCase();
}

function resultGroup(title, items, reference) {
  const group = document.createElement('section');
  group.className = 'result-group';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const list = document.createElement('ul');
  list.className = 'editorial-list';
  group.append(heading, list);
  for (const item of items) {
    const row = document.createElement('li');
    const name = document.createElement('h3');
    const link = document.createElement('a');
    const copy = document.createElement('div');
    row.className = 'editorial-line';
    link.href = item.url;
    link.textContent = item.title;
    name.append(link);
    copy.append(name);
    if (item.summary) {
      const summary = document.createElement('p');
      summary.textContent = readableText(item.summary);
      copy.append(summary);
    }
    if (item.syntax) {
      const syntax = document.createElement('p');
      syntax.className = 'reference-syntax';
      syntax.textContent = item.syntax;
      copy.append(syntax);
    }
    const kind = document.createElement('span');
    kind.className = 'line-meta';
    kind.textContent = reference ? item.kind : item.type;
    row.append(copy, kind);
    list.append(row);
  }
  return group;
}

// Article actions stay local until the reader explicitly chooses Share or Copy link.
for (const actions of document.querySelectorAll('[data-article-url]')) {
  const url = new URL(actions.dataset.articleUrl, location.origin).href;
  const status = actions.querySelector('[role="status"]');
  const bookmark = actions.querySelector('[data-article-action="bookmark"]');
  const disclosure = actions.querySelector('details');
  const summary = disclosure.querySelector('summary');
  const fallback = document.createElement('input');
  fallback.type = 'text';
  fallback.className = 'article-link-fallback';
  fallback.setAttribute('aria-label', 'Article link');
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.value = url;
  actions.append(fallback);
  const key = `tcl:bookmark:${actions.dataset.articleUrl}`;
  try {
    bookmark.setAttribute('aria-pressed', String(localStorage.getItem(key) === '1'));
  } catch {
    bookmark.hidden = true;
  }
  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      fallback.hidden = true;
      status.textContent = 'Article link copied.';
      return true;
    } catch {
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'Select and copy the article link.';
      return false;
    }
  };
  bookmark.addEventListener('click', () => {
    const saved = bookmark.getAttribute('aria-pressed') !== 'true';
    try {
      if (saved) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
      bookmark.setAttribute('aria-pressed', String(saved));
      status.textContent = saved ? 'Article bookmarked on this device.' : 'Bookmark removed.';
    } catch {
      status.textContent = 'Bookmarks are unavailable on this device.';
    }
  });
  actions.querySelector('[data-article-action="share"]').addEventListener('click', async () => {
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({ title: document.querySelector('h1').textContent, url });
      status.textContent = 'Article shared.';
    } catch (error) {
      if (error.name === 'AbortError') status.textContent = 'Share canceled.';
      else await copyLink();
    }
  });
  actions.querySelector('[data-article-action="copy"]').addEventListener('click', async () => {
    const copied = await copyLink();
    disclosure.open = false;
    if (copied) summary.focus();
  });
  actions.querySelector('[data-article-action="print"]').addEventListener('click', () => {
    disclosure.open = false;
    summary.focus();
    window.print();
  });
  actions.addEventListener('keydown', event => {
    if (event.key === 'Escape' && disclosure.open) {
      disclosure.open = false;
      summary.focus();
    }
  });
  actions.hidden = false;
}

function readableText(value) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return decoder.value;
}

const room = document.querySelector('.reading-room');

if (room) {
  const records = [...room.querySelectorAll('[data-resource]')];
  const sections = [...room.querySelectorAll('.resource-section')];
  const form = room.querySelector('.resource-find');
  const query = form.elements.q;
  const clear = form.querySelector('[data-clear-resource-query]');
  const status = room.querySelector('.resource-results');
  const empty = room.querySelector('.resource-empty');
  const shortlist = room.querySelector('.resource-shortlist');
  const toggle = shortlist.querySelector('button');
  const buttons = [...room.querySelectorAll('[data-save-resource]')];
  const storageKey = 'tcl-resource-shortlist';
  const known = new Set(records.map(record => record.dataset.resource));
  let saved = new Set();
  let storageAvailable = false;
  let savedOnly = false;

  try {
    let value;
    try { value = JSON.parse(localStorage.getItem(storageKey) || '[]'); }
    catch { value = []; }
    if (Array.isArray(value)) saved = new Set(value.filter(id => known.has(id)));
    // Verify writes too: some browsers allow reads while rejecting writes.
    localStorage.setItem(storageKey, JSON.stringify([...saved]));
    storageAvailable = true;
  } catch { /* The complete collection and search remain available. */ }

  const syncSaved = () => {
    room.querySelector('.resource-saved-count').textContent = saved.size;
    for (const button of buttons) {
      const kept = saved.has(button.dataset.saveResource);
      button.setAttribute('aria-pressed', String(kept));
      button.querySelector('span').textContent = kept ? 'Kept close' : 'Keep close';
      button.hidden = !storageAvailable;
    }
    shortlist.hidden = !storageAvailable;
  };

  const filter = (updateURL = false) => {
    const words = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const record of records) {
      const match = (!savedOnly || saved.has(record.dataset.resource))
        && words.every(word => record.dataset.resourceSearch.toLocaleLowerCase().includes(word));
      record.hidden = !match;
      if (match) count++;
    }
    for (const section of sections) {
      const visible = [...section.querySelectorAll('[data-resource]')].filter(record => !record.hidden).length;
      section.hidden = visible === 0;
      const badge = section.querySelector('.resource-section-count');
      badge.textContent = String(visible).padStart(2, '0');
      badge.setAttribute('aria-label', `${visible} ${visible === 1 ? 'resource' : 'resources'}`);
    }
    toggle.setAttribute('aria-pressed', String(savedOnly));
    clear.hidden = !query.value;
    status.textContent = `${count} ${count === 1 ? 'resource' : 'resources'} ${savedOnly ? 'in your shortlist' : 'on the shelves'}`;
    empty.hidden = count > 0;
    const unfilledShortlist = savedOnly && saved.size === 0 && words.length === 0;
    empty.querySelector('h2').textContent = unfilledShortlist ? 'Your shelf is waiting.' : 'No resources found.';
    empty.querySelector('p').textContent = unfilledShortlist
      ? 'Use “Keep close” on any resource to make it part of your shortlist.'
      : 'Try another word or browse the whole collection.';
    if (updateURL) {
      const url = new URL(location.href);
      if (query.value.trim()) url.searchParams.set('q', query.value.trim());
      else url.searchParams.delete('q');
      if (savedOnly) url.searchParams.set('saved', '1');
      else url.searchParams.delete('saved');
      history.replaceState(null, '', url);
    }
  };

  const readURL = () => {
    const params = new URLSearchParams(location.search);
    query.value = (params.get('q') || '').slice(0, 100);
    savedOnly = storageAvailable && params.get('saved') === '1';
    filter();
  };

  syncSaved();
  readURL();
  form.hidden = false;
  query.addEventListener('input', () => filter(true));
  form.addEventListener('submit', event => { event.preventDefault(); filter(true); });
  clear.addEventListener('click', () => { query.value = ''; filter(true); query.focus(); });
  toggle.addEventListener('click', () => { savedOnly = !savedOnly; filter(true); });
  room.querySelector('[data-reset-resources]').addEventListener('click', () => {
    query.value = '';
    savedOnly = false;
    filter(true);
    query.focus();
  });
  for (const button of buttons) button.addEventListener('click', () => {
    const id = button.dataset.saveResource;
    const kept = !saved.has(id);
    const next = new Set(saved);
    if (kept) next.add(id);
    else next.delete(id);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      saved = next;
      syncSaved();
      filter();
      status.textContent = `${button.closest('[data-resource]').dataset.resourceTitle} ${kept ? 'added to' : 'removed from'} your shortlist. ${saved.size} saved.`;
      if (savedOnly && !kept) toggle.focus();
    } catch {
      status.textContent = 'Your browser could not save this change. Please try again.';
    }
  });
  addEventListener('popstate', readURL);
  addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
      saved = new Set(Array.isArray(value) ? value.filter(id => known.has(id)) : []);
      syncSaved();
      filter();
    } catch { /* Keep the current state if storage becomes unavailable. */ }
  });

  const links = [...room.querySelectorAll('.resource-shelf-nav a')];
  for (const link of links) link.addEventListener('click', () => {
    if (!query.value && !savedOnly) return;
    query.value = '';
    savedOnly = false;
    filter(true);
  });
  const updateCurrent = () => {
    const visible = sections.filter(section => !section.hidden);
    let current = visible[0];
    for (const section of visible) {
      if (section.getBoundingClientRect().top <= innerHeight * .35) current = section;
    }
    for (const link of links) {
      if (link.hash === `#${current?.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  let pending = false;
  const scheduleCurrent = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; updateCurrent(); });
  };
  addEventListener('scroll', scheduleCurrent, { passive: true });
  addEventListener('resize', scheduleCurrent, { passive: true });
  form.addEventListener('input', scheduleCurrent);
  room.addEventListener('click', scheduleCurrent);
  addEventListener('popstate', scheduleCurrent);
  document.fonts.ready.then(scheduleCurrent);
}

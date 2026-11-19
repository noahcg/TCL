const $ = selector => document.querySelector(selector);
const token = $('meta[name="studio-session"]').content;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const label = type => type === 'article' ? 'Article' : 'Quick Win';
const dateLabel = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const allIdeas = () => state.scans.flatMap(scan => scan.ideas);
let state;
let view = 'ideas';
let timer;
let lastJob;
let initial = true;
let sending = false;
let busy = false;
let lastSnapshot;
let activeRelease;

$('#today').textContent = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

async function api(path, body) {
  const response = await fetch(`/admin/api/${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin',
    headers: { 'X-Admin-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function message(text, error = false) {
  $('#message').textContent = text;
  $('#message').classList.toggle('error', error);
  $('#message').hidden = !text;
}

function links(sources) {
  return sources.map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer" title="${escape(source.title)}">${escape(new URL(source.url).hostname.replace(/^www\./, ''))}</a>`).join('');
}

function actionDisabled(needsAI = false) { return busy || (needsAI && !state.configured) ? ' disabled' : ''; }

function render() {
  busy = state.job?.status === 'running';
  $('#board').setAttribute('aria-busy', String(busy));
  $('#scan-button').disabled = busy || !state.configured;
  $('#scan-button span').textContent = busy && state.job.type === 'scan' ? 'Researching…' : 'Scan the CSS web';
  $('#progress').hidden = !busy;
  if (busy) {
    const text = {
      scan: ['Searching the CSS web…', 'Following sources and finding useful angles. This can take a few minutes.'],
      generate: ['Putting your draft together…', 'Writing an original explanation, CSS examples, and source credits.'],
      publish: ['Preparing your local site…', 'Creating article artwork when needed, then rebuilding the site.'],
      'prepare-live': ['Checking your live publication…', 'Preparing the content and artwork, running tests, and building the release. Nothing goes live until you approve.'],
      'deploy-live': ['Sending your approved release…', 'Saving the release to GitHub and requesting the production deployment.'],
    }[state.job.type];
    $('#progress-title').textContent = text[0]; $('#progress-detail').textContent = text[1];
  }
  const ideas = allIdeas();
  const available = ideas.filter(idea => idea.status !== 'dismissed');
  const drafts = state.drafts.filter(draft => !draft.publishedAt);
  const published = state.drafts.filter(draft => draft.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  $('#idea-count').textContent = available.length;
  $('#draft-count').textContent = drafts.length;
  $('#published-count').textContent = published.length;
  $('#dismissed-count').textContent = ideas.filter(idea => idea.status === 'dismissed').length;
  $('#scan-date').textContent = state.scans[0] ? `Last scan · ${dateLabel(state.scans[0].createdAt)}` : 'Ready when you are';
  $('#model-info').textContent = `Research & writing · ${state.model}`;
  $('#connection').hidden = state.configured;
  $('#connection').textContent = 'One-time setup: add OPENAI_API_KEY to .env.local, then restart with npm run admin. Your key stays on this computer.';
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  const type = $('#type-filter').value;
  const records = (view === 'drafts' ? drafts : view === 'published' ? published : view === 'dismissed' ? ideas.filter(idea => idea.status === 'dismissed') : available)
    .filter(record => type === 'all' || record.type === type);
  if (!records.length) {
    const [title, copy] = view === 'drafts' ? ['A little room for your next draft.', 'Generate an article or Quick Win from a discovery. Your drafts will be kept here.']
      : view === 'published' ? ['Your published collection starts here.', 'Articles and Quick Wins move here after you add them to your local site. Each item shows its live publication status.']
      : view === 'dismissed' ? ['Nothing set aside.', 'Ideas you pass on will live here. Bring them back whenever you like.']
        : state.scans.length ? ['A fresh angle is out there.', 'Try another format or scan with a different focus.']
          : ['Good ideas start with curiosity.', 'Choose your sources and run a scan. Your next article or little CSS aha! starts here.'];
    $('#board').innerHTML = `<div class="empty-state"><span class="empty-art" aria-hidden="true">{ <i>✳</i> }</span><h3>${title}</h3><p>${copy}</p><div class="empty-formats"><span>In-depth articles</span><span>Quick Wins</span><span>Verified source links</span></div></div>`;
  } else $('#board').innerHTML = records.map(record => ['drafts', 'published'].includes(view) ? draftCard(record) : ideaCard(record)).join('');
  $('#scan-history').hidden = !state.scans.length;
  $('#history-list').innerHTML = state.scans.map(scan => {
    const selected = state.sources.filter(source => scan.sourceIds.includes(source.id));
    return `<div class="history-entry"><strong>${escape(dateLabel(scan.createdAt))} · ${scan.ideas.length} ideas</strong><p>${escape(scan.focus || 'Modern CSS, across the board')} · ${scan.days}-day window</p><p>${selected.map(source => `${escape(source.name)}: ${scan.sources.some(link => { const host = new URL(link.url).hostname; return host === source.domain || host.endsWith('.' + source.domain); }) ? 'sources found' : 'no cited results'}`).join(' · ')}</p><div>${links(scan.sources)}</div></div>`;
  }).join('');
}

function ideaCard(idea) {
  const draft = state.drafts.find(draft => draft.ideaId === idea.id);
  return `<article class="idea-card"><div class="card-top"><span class="format${idea.type === 'quick-win' ? ' quick' : ''}">${label(idea.type)}</span><span class="feature">${escape(idea.feature)}</span></div><h3>${escape(idea.title)}</h3><p class="card-summary">${escape(idea.summary)}</p><p class="card-rationale"><strong>Why this one?</strong> ${escape(idea.rationale)}</p><p class="compatibility">${escape(idea.compatibility)}</p><div class="card-sources"><span class="source-heading">From</span>${links(idea.sources)}</div><details class="card-details"><summary>The angle & existing coverage</summary><ul>${idea.outline.map(point => `<li>${escape(point)}</li>`).join('')}</ul><p>${idea.related.length ? 'Related coverage: ' + idea.related.map(entry => `<a href="${escape(entry.path)}" target="_blank" rel="noopener">${escape(entry.title)}</a>`).join(', ') : 'No related tags in the current content collection.'}</p></details><div class="card-actions">${idea.status === 'dismissed' ? `<button type="button" class="secondary" data-action="restore" data-id="${idea.id}"${actionDisabled()}>Bring back</button>` : `<button type="button" class="primary" data-action="${draft ? 'edit' : 'generate'}" data-id="${draft?.id || idea.id}"${actionDisabled(!draft)}>${draft ? draft.publishedAt ? 'View published item' : 'Open draft' : `Generate ${idea.type === 'article' ? 'article' : 'Quick Win'}`}</button><button type="button" class="text-button" data-action="dismiss" data-id="${idea.id}"${actionDisabled()}>Set aside</button>`}</div></article>`;
}

function draftCard(draft) {
  const release = (state.releases || []).find(item => item.draftId === draft.id);
  const live = draft.publishedAt && state.livePublishing;
  return `<article class="draft-card"><div class="card-top"><span class="format${draft.type === 'quick-win' ? ' quick' : ''}">${label(draft.type)}</span><span class="feature">${release?.status === 'submitted' ? 'Sent for live deployment' : draft.publishedAt ? 'Added to local site' : draft.savedAt ? 'Saved to content' : 'Ready for review'}</span></div><h3>${escape(draft.title)}</h3><p class="card-summary">${escape(draft.summary)}</p><div class="card-sources">${links(draft.sources)}</div><div class="card-actions"><button type="button" class="secondary" data-action="edit" data-id="${draft.id}"${actionDisabled()}>${draft.publishedAt ? 'View content' : 'Review & edit'}</button>${draft.publishedAt ? `<a href="/${draft.type === 'article' ? 'articles' : 'quick-wins'}/${escape(draft.slug)}/" target="_blank" rel="noopener">View local preview</a>` : ''}${live ? `<button type="button" class="${release?.status === 'submitted' ? 'secondary' : 'primary'}" data-action="live" data-id="${draft.id}"${actionDisabled()}>${release?.status === 'submitted' ? 'View publication' : 'Review live publication'}</button>` : ''}</div></article>`;
}

async function refresh() {
  clearTimeout(timer);
  try {
    state = await api('state');
    if (initial) {
      $('#sources').innerHTML = state.sources.map(source => `<label class="source-option"><input type="checkbox" name="source" value="${source.id}"${!state.scans[0] || state.scans[0].sourceIds.includes(source.id) ? ' checked' : ''}><span><strong>${escape(source.name)}</strong><small>${escape(source.detail)}</small></span></label>`).join('');
      if (state.scans[0]) { $('#days').value = state.scans[0].days; $('#focus').value = state.scans[0].focus; }
      initial = false;
      // Do not replay success messages on every page load.
      if (state.job?.status === 'complete') lastJob = `${state.job.startedAt}:${state.job.status}`;
    }
    const snapshot = JSON.stringify(state);
    if (snapshot !== lastSnapshot) { render(); lastSnapshot = snapshot; }
    if (state.job && state.job.status !== 'running') {
      const key = `${state.job.startedAt}:${state.job.status}`;
      if (key !== lastJob) {
        lastJob = key;
        if (state.job.status === 'error') {
          message(state.job.error, true);
          if (state.job.type === 'deploy-live' && activeRelease) openLiveReview(activeRelease);
        }
        else if (state.job.type === 'scan') { view = 'ideas'; message('Fresh ideas are in. Pick an angle and make it yours.'); render(); }
        else if (state.job.type === 'generate') {
          view = 'drafts'; render(); message('Your draft is ready for review.'); openDraft(state.job.resultId);
        } else if (state.job.type === 'prepare-live') {
          message('Release checks passed. Review the update and approve when you’re ready.');
          openLiveReview(state.job.resultId);
        } else if (state.job.type === 'deploy-live') {
          view = 'published'; render();
          message('Your approved release was sent to GitHub. Vercel is handling the live deployment.');
          openLiveReview(state.job.resultId);
        } else {
          view = 'published'; render();
          message('Moved to Published and added to your local site. Check the preview, then choose Review live publication to send it live.');
        }
      }
    }
  } catch (error) { message(`${error.message} If the studio restarted, refresh this page.`, true); }
  timer = setTimeout(refresh, state?.job?.status === 'running' ? 2000 : 15000);
}

$('#scan-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || busy) return;
  const sourceIds = [...document.querySelectorAll('[name=source]:checked')].map(input => input.value);
  if (!sourceIds.length) { message('Choose at least one place to search.', true); return; }
  sending = true; $('#scan-button').disabled = true;
  try {
    message('');
    await api('scan', { sourceIds, days: Number($('#days').value), focus: $('#focus').value.trim() });
    await refresh();
  } catch (error) { message(error.message, true); $('#scan-button').disabled = false; }
  finally { sending = false; }
});

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; render(); }));
$('#type-filter').addEventListener('change', () => render());

$('#board').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled || sending || busy) return;
  const { action, id } = button.dataset;
  if (action === 'edit') { openDraft(id); return; }
  if (action === 'live') { startLive(id); return; }
  sending = true; button.disabled = true;
  try {
    message('');
    const result = await api(action === 'restore' ? 'dismiss' : action, { id, ...(action === 'restore' ? { restore: true } : {}) });
    if (action === 'generate' && result.id) openDraft(result.id);
    await refresh();
  } catch (error) { message(error.message, true); button.disabled = false; }
  finally { sending = false; }
});

function openDraft(id) {
  const draft = state.drafts.find(item => item.id === id);
  if (!draft) return;
  $('#editor-heading').textContent = draft.publishedAt ? `Published ${draft.type === 'article' ? 'article' : 'Quick Win'}` : 'Review your draft';
  $('#draft-id').value = draft.id;
  for (const field of ['title', 'slug', 'summary', 'body', 'code', 'note', 'difficulty']) $('#draft-' + field).value = draft[field] || '';
  $('#draft-tags').value = draft.tags.join(', ');
  $('#draft-slug').readOnly = Boolean(draft.savedFile);
  $('#quick-fields').hidden = draft.type !== 'quick-win';
  $('#draft-preview').hidden = true; $('#draft-body').hidden = false;
  $('#preview-draft').textContent = 'Preview formatting';
  $('#reviewed').checked = false;
  $('#publish-draft').disabled = true;
  $('#reviewed').disabled = Boolean(draft.publishedAt);
  $('#save-draft').disabled = Boolean(draft.publishedAt);
  $('#editor-live').hidden = !draft.publishedAt || !state.livePublishing;
  document.querySelectorAll('.editor-fields input, .editor-fields textarea').forEach(field => { field.readOnly = Boolean(draft.publishedAt) || (field.id === 'draft-slug' && Boolean(draft.savedFile)); });
  $('#draft-difficulty').disabled = Boolean(draft.publishedAt);
  $('#editor-status').classList.remove('error');
  $('#editor-status').textContent = draft.publishedAt ? `Added to local site · ${dateLabel(draft.publishedAt)}` : draft.savedAt ? `Saved in content/authored/${draft.savedFile}` : 'AI draft · Review the code, facts, and source credits before publication.';
  $('#publish-note').textContent = draft.publishedAt ? 'Review your local preview, then use Review live publication to check and approve the production update.'
    : draft.type === 'article' ? 'Add to local site generates unique article artwork using API credits, then rebuilds your local preview. You can review and approve a live publication afterward.' : 'Add to local site rebuilds your local preview. You can review and approve a live publication afterward.';
  if (!$('#editor').open) $('#editor').showModal();
}

function editedDraft() {
  const body = { id: $('#draft-id').value, tags: $('#draft-tags').value.split(',').map(tag => tag.trim()).filter(Boolean) };
  for (const field of ['title', 'slug', 'summary', 'body', 'code', 'note', 'difficulty']) body[field] = $('#draft-' + field).value;
  return body;
}

$('#close-editor').addEventListener('click', () => $('#editor').close());
$('#reviewed').addEventListener('change', () => { $('#publish-draft').disabled = !$('#reviewed').checked || busy || sending; });
$('#editor-form').addEventListener('input', event => {
  if (event.target.id === 'reviewed') return;
  $('#reviewed').checked = false; $('#publish-draft').disabled = true;
  $('#editor-status').textContent = 'Unsaved edits · Save the draft to keep your changes.';
});
$('#preview-draft').addEventListener('click', async () => {
  if (!$('#draft-preview').hidden) {
    $('#draft-preview').hidden = true; $('#draft-body').hidden = false; $('#preview-draft').textContent = 'Preview formatting'; return;
  }
  try {
    const result = await api('preview', editedDraft());
    // HTML is rendered and sanitized on the server using the publication's content pipeline.
    $('#draft-preview').innerHTML = result.html;
    $('#draft-preview').hidden = false; $('#draft-body').hidden = true; $('#preview-draft').textContent = 'Back to Markdown';
  } catch (error) { $('#editor-status').textContent = error.message; $('#editor-status').classList.add('error'); }
});

async function save(publish) {
  if (sending || busy || !$('#editor-form').reportValidity() || (publish && !$('#reviewed').checked)) return;
  sending = true;
  $('#save-draft').disabled = true; $('#publish-draft').disabled = true;
  try {
    const result = await api(publish ? 'publish' : 'save', editedDraft());
    $('#editor-status').classList.remove('error');
    $('#editor-status').textContent = publish ? 'Preparing your local site…' : `Saved to ${result.file}`;
    if (publish) $('#editor').close();
    await refresh();
    if (!publish) { $('#draft-slug').readOnly = true; $('#reviewed').checked = false; }
  } catch (error) { $('#editor-status').textContent = error.message; $('#editor-status').classList.add('error'); }
  finally { sending = false; $('#save-draft').disabled = false; $('#publish-draft').disabled = !$('#reviewed').checked || busy; }
}
$('#editor-form').addEventListener('submit', event => { event.preventDefault(); save(false); });
$('#publish-draft').addEventListener('click', () => save(true));

async function startLive(draftId, again = false) {
  if (sending || busy) return;
  const existing = (state.releases || []).find(release => release.draftId === draftId);
  if (existing && !again) { openLiveReview(existing.id); return; }
  sending = true;
  try {
    message('');
    await api('prepare-live', { id: draftId });
    $('#editor').close(); $('#live-review').close();
    await refresh();
  } catch (error) { message(error.message, true); }
  finally { sending = false; }
}

function openLiveReview(id) {
  const release = (state.releases || []).find(item => item.id === id);
  if (!release) return;
  activeRelease = id;
  const submitted = release.status === 'submitted';
  $('#live-summary').innerHTML = `<div class="release-heading"><span class="format${release.type === 'quick-win' ? ' quick' : ''}">${label(release.type)}</span><h3>${escape(release.title)}</h3></div><p class="release-checks">${escape(release.checks)}</p><dl class="release-facts"><div><dt>Destination</dt><dd>${escape(release.repository)} · ${escape(release.branch)}</dd></div><div><dt>Prepared</dt><dd>${escape(dateLabel(release.createdAt))} · ${escape(release.commit.slice(0, 7))}</dd></div></dl><details class="release-files"><summary>${release.files.length} files in this publication</summary><ul>${release.files.map(file => `<li><code>${escape(file.path)}</code></li>`).join('')}</ul></details><details class="release-files"><summary>Inspect the content changes</summary><pre class="live-diff">${escape(release.diff)}</pre></details>${submitted ? `<p class="deployment-links"><a href="${escape(release.deploymentUrl)}" target="_blank" rel="noopener noreferrer">Track deployment on GitHub</a>${release.liveUrl ? `<a href="${escape(release.liveUrl)}" target="_blank" rel="noopener noreferrer">Open live page</a>` : ''}</p>` : ''}`;
  $('#live-status').textContent = submitted ? 'Sent for production deployment. Follow the deployment check to see when Vercel has finished.' : release.error || 'The checked release is ready. Publishing starts only after your approval below.';
  $('#live-status').classList.toggle('error', Boolean(release.error));
  $('#live-approved').checked = false;
  $('#live-approval-row').hidden = submitted;
  $('#approve-live').hidden = submitted;
  $('#approve-live').disabled = true;
  $('#approve-live').textContent = release.status === 'failed' ? 'Approve & retry publication' : 'Approve & publish live';
  $('#prepare-again').hidden = submitted;
  $('#cancel-live').textContent = submitted ? 'Done' : 'Keep reviewing';
  if (!$('#live-review').open) $('#live-review').showModal();
}

$('#editor-live').addEventListener('click', () => { const id = $('#draft-id').value; $('#editor').close(); startLive(id); });
$('#close-live').addEventListener('click', () => $('#live-review').close());
$('#cancel-live').addEventListener('click', () => $('#live-review').close());
$('#live-approved').addEventListener('change', () => { $('#approve-live').disabled = !$('#live-approved').checked || sending || busy; });
$('#prepare-again').addEventListener('click', () => {
  const release = (state.releases || []).find(item => item.id === activeRelease);
  if (release) startLive(release.draftId, true);
});
$('#approve-live').addEventListener('click', async () => {
  if (sending || busy || !$('#live-approved').checked || !activeRelease) return;
  sending = true; $('#approve-live').disabled = true;
  try {
    await api('deploy-live', { id: activeRelease, approved: true });
    $('#live-review').close();
    await refresh();
  } catch (error) { $('#live-status').textContent = error.message; $('#live-status').classList.add('error'); }
  finally { sending = false; }
});
refresh();

// This form has its own snapshot, so research polling never replaces unsaved edits.
let homepageSettings;
let homepageDemoArticles = {};
let homepageUsedDemos = [];
let homepageView = 'overview';
let homepageProposals = [];
let homepageDirty = false;
let homepageSaving = false;
let homepageScheduleDirty = false;
function setHomepageView(view) {
  homepageView = view;
  for (const id of ['overview', 'ideas', 'schedule']) $('#homepage-' + id).hidden = view !== id;
  $('#homepage-form').hidden = view !== 'edit' || !homepageSettings;
  document.querySelectorAll('.homepage-tabs [data-home-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.homeView === view)));
}
for (const button of document.querySelectorAll('[data-home-view]')) button.addEventListener('click', () => setHomepageView(button.dataset.homeView));
function showHomepageTopic() {
  for (const fieldset of document.querySelectorAll('#homepage-copy fieldset')) fieldset.hidden = fieldset.dataset.editorTopic !== $('#homepage-edit-topic').value;
}
$('#homepage-edit-topic').addEventListener('change', showHomepageTopic);
function renderHomepageIdeas() {
  const query = $('#homepage-idea-search').value.trim().toLowerCase();
  const filter = $('#homepage-idea-state').value;
  const proposals = homepageProposals.filter(item => (filter === 'all' || (filter === 'demonstrated' ? item.status === 'demonstrated' : item.status !== 'demonstrated')) && [item.articleTitle, item.title, item.interaction, item.result].join(' ').toLowerCase().includes(query));
  $('#homepage-ideas-status').textContent = `${proposals.length} of ${homepageProposals.length} article demos`;
  $('#homepage-proposals').innerHTML = proposals.map(item => `<details class="homepage-proposal"><summary><span class="homepage-proposal-article">${escape(item.articleTitle)}</span><span class="homepage-proposal-title">${escape(item.title)}</span><span class="homepage-proposal-state">${item.status === 'demonstrated' ? 'Demonstrated' : item.status === 'needed' ? 'Needs a demo' : 'Ready'}</span></summary><div class="homepage-proposal-body"><dl><div><dt>Try this</dt><dd>${escape(item.interaction)}</dd></div><div><dt>What you’ll see</dt><dd>${escape(item.result)}</dd></div><div><dt>Implementation notes</dt><dd>${escape(item.fallback)}</dd></div></dl><div class="homepage-actions">${item.demoId ? `<a href="/admin/demo-preview/${escape(item.demoId)}/#css-in-action" target="_blank" rel="noopener">Preview demo</a><button type="button" class="secondary" data-home-use="${escape(item.demoId)}">Use now</button><button type="button" class="secondary" data-home-plan="${escape(item.demoId)}">Choose a month</button>` : ''}</div><a href="${escape(item.articlePath)}" target="_blank" rel="noopener">Read the article</a><p>${item.status === 'demonstrated' ? 'Already demonstrated · excluded from new ideas.' : 'Working demo · preview it or choose a month in Schedule demos.'}</p>${item.status !== 'demonstrated' && item.status !== 'needed' ? `<button type="button" class="secondary" data-home-demonstrated="${escape(item.articleSlug)}">Mark demonstrated</button>` : ''}</div></details>`).join('') || '<p class="homepage-no-ideas">No matching demos. Try another search or filter.</p>';
}
$('#homepage-idea-search').addEventListener('input', renderHomepageIdeas);
$('#homepage-idea-state').addEventListener('change', renderHomepageIdeas);
function renderHomepage(data) {
  homepageSettings = data.config;
  renderHomepageSchedule(data);
  homepageDirty = false;
  homepageScheduleDirty = false;
  $('#homepage-quick-demo').innerHTML = Object.entries(data.config.features).map(([id, item]) => `<option value="${escape(id)}">${escape(item.topic)}${id === data.current.id ? ' · current' : (data.demonstratedDemos || data.config.usedDemos).includes(id) ? ' · demonstrated' : ''}</option>`).join('');
  $('#homepage-quick-demo').value = data.current.id;
  $('#homepage-quick-demo').disabled = false;
  $('#homepage-switch').disabled = false;
  $('#homepage-mode').value = data.config.mode;
  $('#homepage-start').value = data.config.startMonth;
  const entries = Object.entries(data.config.features);
  $('#homepage-pinned').innerHTML = entries.map(([id, item]) => `<option value="${escape(id)}">${escape(item.topic)}</option>`).join('');
  $('#homepage-pinned').value = data.config.pinned;
  const ordered = [...data.config.queue, ...entries.map(([id]) => id).filter(id => !data.config.queue.includes(id))];
  $('#homepage-queue').innerHTML = ordered.map(id => `<option value="${escape(id)}"${data.config.queue.includes(id) ? ' selected' : ''}>${escape(data.config.features[id].topic)}</option>`).join('');
  const editTopic = $('#homepage-edit-topic').value || data.current.id;
  $('#homepage-edit-topic').innerHTML = entries.map(([id, item]) => `<option value="${escape(id)}">${escape(item.topic)}</option>`).join('');
  $('#homepage-edit-topic').value = editTopic;
  $('#homepage-copy').innerHTML = entries.map(([id, item]) => `<fieldset data-editor-topic="${escape(id)}"><legend>${escape(item.topic)}</legend>${['topic','headline','explanation','demoTitle','demoDescription'].map(key => `<div class="homepage-edit-field"><label for="home-${id}-${key}">${escape(({demoTitle:'Demo title',demoDescription:'Demo description'})[key] || key[0].toUpperCase() + key.slice(1))}</label><textarea rows="${key === 'explanation' || key === 'demoDescription' ? 3 : 2}" id="home-${id}-${key}" data-home-id="${id}" data-home-key="${key}" required maxlength="1000">${escape(item[key])}</textarea></div>`).join('')}</fieldset>`).join('');
  $('#homepage-status').textContent = `Local preview: ${data.current.topic}. Publish settings to update the live site.`;
  $('#homepage-current-topic').textContent = data.current.topic;
  $('#homepage-current-headline').textContent = data.current.headline;
  $('#homepage-mode-label').textContent = data.config.mode === 'monthly' ? 'Monthly rotation · UTC' : 'Pinned selection';
  $('#homepage-ready-count').textContent = `${entries.length} working demos available`;
  $('#homepage-upcoming').innerHTML = data.upcoming.map(item => `<li><time datetime="${escape(item.month)}">${escape(new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(item.month + '-01T12:00:00Z')))}</time><strong>${escape(item.topic)}</strong><span>${item.holding ? (data.config.mode === 'manual' ? 'Pinned' : 'Retained · queue complete') : 'Upcoming demo'}</span></li>`).join('');
  homepageProposals = data.proposals || [];
  $('#homepage-idea-count').textContent = homepageProposals.length;
  renderHomepageIdeas();
  showHomepageTopic();
  setHomepageView(homepageView);
}
for (const direction of ['up', 'down']) $('#homepage-' + direction).addEventListener('click', () => {
  const select = $('#homepage-queue');
  const options = [...select.options];
  for (const option of direction === 'up' ? options : options.reverse()) {
    const neighbor = direction === 'up' ? option.previousElementSibling : option.nextElementSibling;
    if (option.selected && neighbor && !neighbor.selected) {
      if (direction === 'up') select.insertBefore(option, neighbor);
      else select.insertBefore(neighbor, option);
    }
  }
});
$('#homepage-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (homepageScheduleDirty) { $('#homepage-status').textContent = 'Save your schedule edits before saving copy.'; return; }
  const button = event.submitter;
  button.disabled = true;
  try {
    const config = structuredClone(homepageSettings);
    config.mode = $('#homepage-mode').value;
    config.startMonth = $('#homepage-start').value;
    config.pinned = $('#homepage-pinned').value;
    config.queue = [...$('#homepage-queue').selectedOptions].map(option => option.value);
    for (const field of document.querySelectorAll('[data-home-id]')) config.features[field.dataset.homeId][field.dataset.homeKey] = field.value;
    renderHomepage(await api('homepage-feature', { config, expected: homepageSettings }));
    $('#homepage-status').textContent += ' Saved and local preview rebuilt.';
  } catch (error) { $('#homepage-status').textContent = error.message; }
  finally { button.disabled = false; }
});
api('homepage-feature').then(renderHomepage).catch(error => { $('#homepage-status').textContent = error.message; });

for (const event of ['input', 'change']) $('#homepage-form').addEventListener(event, () => { homepageDirty = true; });
async function saveHomepageAction(action, success) {
  if (homepageSaving || !homepageSettings) return;
  if (homepageDirty || homepageScheduleDirty) { $('#homepage-status').textContent = 'Save your copy or schedule edits before switching or marking a demo.'; return; }
  homepageSaving = true;
  $('#homepage-switch').disabled = true;
  try {
    renderHomepage(await api('homepage-feature', { expected: homepageSettings, ...action }));
    $('#homepage-status').textContent = success;
  } catch (error) { $('#homepage-status').textContent = error.message; }
  finally { homepageSaving = false; $('#homepage-switch').disabled = false; }
}
$('#homepage-switch').addEventListener('click', () => saveHomepageAction({ activate: $('#homepage-quick-demo').value }, 'Demo switched and pinned in the local preview. History saved; publish settings to update the live site.'));
$('#homepage-proposals').addEventListener('click', event => {
  const button = event.target.closest('[data-home-demonstrated]');
  if (button) saveHomepageAction({ demonstratedArticle: button.dataset.homeDemonstrated }, 'Marked demonstrated. This idea will stay out of new proposals.');
});

function monthLabel(month) { return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z')); }
function renderHomepageSchedule(data) {
  homepageDemoArticles = data.demoArticles || {};
  homepageUsedDemos = data.demonstratedDemos || data.config.usedDemos;
  const months = data.schedulingMonths || [];
  const used = new Set(data.demonstratedDemos || data.config.usedDemos);
  $('#homepage-schedule-mode').textContent = data.config.mode === 'manual' ? 'A demo is pinned now. Saving a schedule turns monthly scheduling on.' : 'Monthly scheduling is on. All dates use UTC months.';
  $('#homepage-months').innerHTML = months.map(month => `<div class="homepage-month"><label for="home-month-${month}">${escape(monthLabel(month))}</label><select id="home-month-${month}" data-home-month="${month}"><option value="">Keep previous demo</option>${Object.entries(data.config.features).map(([id,item]) => `<option value="${escape(id)}"${data.config.schedule[month] === id ? ' selected' : ''}${used.has(id) && data.config.schedule[month] !== id ? ' disabled' : ''}>${escape(item.topic)}${used.has(id) ? ' · demonstrated' : ''}</option>`).join('')}</select></div>`).join('');
}
$('#homepage-schedule').addEventListener('change', event => {
  homepageScheduleDirty = true;
  $('#homepage-schedule-status').textContent = 'Unsaved month choices. Click Save schedule to apply them.';
  const chosen = event.target.closest('[data-home-month]');
  if (chosen?.value) for (const other of document.querySelectorAll('[data-home-month]')) {
    if (other !== chosen && other.value === chosen.value) {
      other.value = '';
      $('#homepage-schedule-status').textContent = `Moved this demo from ${monthLabel(other.dataset.homeMonth)} to ${monthLabel(chosen.dataset.homeMonth)}. Click Save schedule to apply.`;
    }
  }
});
$('#homepage-fill-schedule').addEventListener('click', () => {
  homepageScheduleDirty = true;
  const usedDemos = new Set([...homepageSettings.usedDemos, ...homepageUsedDemos]);
  const usedArticles = new Set([...homepageSettings.usedArticles, ...[...usedDemos].map(id=>homepageDemoArticles[id]).filter(Boolean)]);
  const fields = [...document.querySelectorAll('[data-home-month]')];
  const selected = new Set(fields.map(field => field.value).filter(Boolean));
  const available = Object.keys(homepageSettings.features).filter(id => homepageDemoArticles[id] && !usedDemos.has(id) && !usedArticles.has(homepageDemoArticles[id]) && !selected.has(id));
  const seen = new Set();
  const distinct = available.filter(id => { const article = homepageDemoArticles[id]; if (seen.has(article)) return false; seen.add(article); return true; });
  const currentMonth = new Date().toISOString().slice(0,7);
  let placed = 0;
  for (const field of fields) if (!field.value && field.dataset.homeMonth > currentMonth && distinct.length) { field.value = distinct.shift(); placed++; }
  $('#homepage-schedule-status').textContent = placed ? `${placed} unused article demos placed in future months. Review the choices, then click Save schedule.` : 'All unused article demos already have a month. You can change their month choices directly.';
});
$('#homepage-schedule').addEventListener('submit', async event => {
  event.preventDefault();
  if (homepageDirty) { $('#homepage-schedule-status').textContent = 'Save your copy edits first, then save the schedule.'; return; }
  const button = event.submitter;
  button.disabled = true;
  $('#homepage-schedule-status').textContent = 'Saving schedule and rebuilding the local preview…';
  try {
    const config = structuredClone(homepageSettings);
    config.mode = 'monthly';
    for (const field of document.querySelectorAll('[data-home-month]')) {
      if (field.value) config.schedule[field.dataset.homeMonth] = field.value;
      else delete config.schedule[field.dataset.homeMonth];
    }
    if (!Object.keys(config.schedule).length) { config.mode = 'manual'; config.pinned = $('#homepage-quick-demo').value; }
    renderHomepage(await api('homepage-feature', { expected: homepageSettings, config }));
    $('#homepage-schedule-status').textContent = 'Schedule saved and local preview rebuilt. Publish settings to apply these months live.';
  } catch (error) { $('#homepage-schedule-status').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#homepage-proposals').addEventListener('click', event => {
  const use = event.target.closest('[data-home-use]');
  if (use) saveHomepageAction({ activate: use.dataset.homeUse }, 'Demo selected and local preview rebuilt. History saved.');
  const plan = event.target.closest('[data-home-plan]');
  if (plan) {
    setHomepageView('schedule');
    $('#homepage-schedule-status').textContent = 'Choose a month for this demo, then click Save schedule.';
    const field = [...document.querySelectorAll('[data-home-month]')].find(field => !field.value && !field.querySelector(`option[value="${plan.dataset.homePlan}"]`)?.disabled);
    if (field) { field.value = plan.dataset.homePlan; homepageScheduleDirty = true; field.focus(); }
    else $('#homepage-schedule-status').textContent = 'This demo is already demonstrated or no month is free. Used demos can be revisited with Use now.';
  }
});

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
  $('#idea-count').textContent = available.length;
  $('#draft-count').textContent = state.drafts.length;
  $('#dismissed-count').textContent = ideas.filter(idea => idea.status === 'dismissed').length;
  $('#scan-date').textContent = state.scans[0] ? `Last scan · ${dateLabel(state.scans[0].createdAt)}` : 'Ready when you are';
  $('#model-info').textContent = `Research & writing · ${state.model}`;
  $('#connection').hidden = state.configured;
  $('#connection').textContent = 'One-time setup: add OPENAI_API_KEY to .env.local, then restart with npm run admin. Your key stays on this computer.';
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  const type = $('#type-filter').value;
  const records = (view === 'drafts' ? state.drafts : view === 'dismissed' ? ideas.filter(idea => idea.status === 'dismissed') : available)
    .filter(record => type === 'all' || record.type === type);
  if (!records.length) {
    const [title, copy] = view === 'drafts' ? ['A little room for your next draft.', 'Generate an article or Quick Win from a discovery. Your drafts will be kept here.']
      : view === 'dismissed' ? ['Nothing set aside.', 'Ideas you pass on will live here. Bring them back whenever you like.']
        : state.scans.length ? ['A fresh angle is out there.', 'Try another format or scan with a different focus.']
          : ['Good ideas start with curiosity.', 'Choose your sources and run a scan. Your next article or little CSS aha! starts here.'];
    $('#board').innerHTML = `<div class="empty-state"><span class="empty-art" aria-hidden="true">{ <i>✳</i> }</span><h3>${title}</h3><p>${copy}</p><div class="empty-formats"><span>In-depth articles</span><span>Quick Wins</span><span>Verified source links</span></div></div>`;
  } else $('#board').innerHTML = records.map(record => view === 'drafts' ? draftCard(record) : ideaCard(record)).join('');
  $('#scan-history').hidden = !state.scans.length;
  $('#history-list').innerHTML = state.scans.map(scan => {
    const selected = state.sources.filter(source => scan.sourceIds.includes(source.id));
    return `<div class="history-entry"><strong>${escape(dateLabel(scan.createdAt))} · ${scan.ideas.length} ideas</strong><p>${escape(scan.focus || 'Modern CSS, across the board')} · ${scan.days}-day window</p><p>${selected.map(source => `${escape(source.name)}: ${scan.sources.some(link => { const host = new URL(link.url).hostname; return host === source.domain || host.endsWith('.' + source.domain); }) ? 'sources found' : 'no cited results'}`).join(' · ')}</p><div>${links(scan.sources)}</div></div>`;
  }).join('');
}

function ideaCard(idea) {
  const draft = state.drafts.find(draft => draft.ideaId === idea.id);
  return `<article class="idea-card"><div class="card-top"><span class="format${idea.type === 'quick-win' ? ' quick' : ''}">${label(idea.type)}</span><span class="feature">${escape(idea.feature)}</span></div><h3>${escape(idea.title)}</h3><p class="card-summary">${escape(idea.summary)}</p><p class="card-rationale"><strong>Why this one?</strong> ${escape(idea.rationale)}</p><p class="compatibility">${escape(idea.compatibility)}</p><div class="card-sources"><span class="source-heading">From</span>${links(idea.sources)}</div><details class="card-details"><summary>The angle & existing coverage</summary><ul>${idea.outline.map(point => `<li>${escape(point)}</li>`).join('')}</ul><p>${idea.related.length ? 'Related coverage: ' + idea.related.map(entry => `<a href="${escape(entry.path)}" target="_blank" rel="noopener">${escape(entry.title)}</a>`).join(', ') : 'No related tags in the current content collection.'}</p></details><div class="card-actions">${idea.status === 'dismissed' ? `<button type="button" class="secondary" data-action="restore" data-id="${idea.id}"${actionDisabled()}>Bring back</button>` : `<button type="button" class="primary" data-action="${draft ? 'edit' : 'generate'}" data-id="${draft?.id || idea.id}"${actionDisabled(!draft)}>${draft ? draft.publishedAt ? 'View saved draft' : 'Open draft' : `Generate ${idea.type === 'article' ? 'article' : 'Quick Win'}`}</button><button type="button" class="text-button" data-action="dismiss" data-id="${idea.id}"${actionDisabled()}>Set aside</button>`}</div></article>`;
}

function draftCard(draft) {
  const release = (state.releases || []).find(item => item.draftId === draft.id);
  const live = draft.publishedAt && state.livePublishing;
  return `<article class="draft-card"><div class="card-top"><span class="format${draft.type === 'quick-win' ? ' quick' : ''}">${label(draft.type)}</span><span class="feature">${release?.status === 'submitted' ? 'Sent for live deployment' : draft.publishedAt ? 'Added to local site' : draft.savedAt ? 'Saved to content' : 'Ready for review'}</span></div><h3>${escape(draft.title)}</h3><p class="card-summary">${escape(draft.summary)}</p><div class="card-sources">${links(draft.sources)}</div><div class="card-actions"><button type="button" class="secondary" data-action="edit" data-id="${draft.id}"${actionDisabled()}>${draft.publishedAt ? 'View draft' : 'Review & edit'}</button>${draft.publishedAt ? `<a href="/${draft.type === 'article' ? 'articles' : 'quick-wins'}/${escape(draft.slug)}/" target="_blank" rel="noopener">View local preview</a>` : ''}${live ? `<button type="button" class="${release?.status === 'submitted' ? 'secondary' : 'primary'}" data-action="live" data-id="${draft.id}"${actionDisabled()}>${release?.status === 'submitted' ? 'View publication' : 'Review live publication'}</button>` : ''}</div></article>`;
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
          message('Your approved release was sent to GitHub. Vercel is handling the live deployment.');
          openLiveReview(state.job.resultId);
        } else {
          view = 'drafts'; render();
          message('Added to your local site. Check the preview, then choose Review live publication to send it live.');
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

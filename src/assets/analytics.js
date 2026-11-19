import { inject } from './vercel-analytics.js';

// This module is included only in Vercel production builds.
// Keep an exported production build quiet when previewed over local HTTP.
if (location.protocol === 'https:') {
  const url = new URL(location.href);
  const preference = url.searchParams.get('analytics');
  let disabled = false;
  let saved = true;

  try {
    if (preference === 'off') localStorage.setItem('va-disable', '1');
    if (preference === 'on') localStorage.removeItem('va-disable');
    disabled = localStorage.getItem('va-disable') === '1';
  } catch {
    saved = false;
    // Honor an explicit opt-out for this visit even if persistence is blocked.
    disabled = preference === 'off';
  }

  if (preference === 'off' || preference === 'on') {
    url.searchParams.delete('analytics');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    const notice = document.createElement('aside');
    notice.className = 'analytics-preference-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = !saved
      ? 'Browser storage is unavailable. This preference could not be saved.'
      : disabled
        ? 'Your visits in this browser are excluded from analytics.'
        : 'Analytics is enabled again in this browser.';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => notice.remove());
    notice.append(dismiss);
    document.body.append(notice);
  }

  if (!disabled) {
    inject({
      mode: 'production',
      beforeSend(event) {
        try {
          if (localStorage.getItem('va-disable') === '1') return null;
        } catch {
          // Storage restrictions should not break the rest of the page.
        }
        return event;
      },
    });
  }
}

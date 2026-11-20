// This shared module is included only in production builds.
// Keep an exported production build quiet when previewed over local HTTP.
if (location.protocol === 'https:') {
  const options = document.querySelector('script[src="/assets/analytics.js"]')?.dataset || {};
  const measurementId = options.gaMeasurementId;
  const privacySignal = navigator.globalPrivacyControl === true
    || navigator.doNotTrack === '1' || window.doNotTrack === '1';
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
      : disabled || privacySignal
        ? 'Your visits in this browser are excluded from analytics.'
        : 'Analytics is enabled again in this browser.';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => notice.remove());
    notice.append(dismiss);
    document.body.append(notice);
  }

  const isDisabled = () => {
    if (disabled || privacySignal) return true;
    try {
      return localStorage.getItem('va-disable') === '1';
    } catch {
      return false;
    }
  };

  const syncGoogleAnalytics = () => {
    if (!measurementId) return;
    const excluded = isDisabled();
    window[`ga-disable-${measurementId}`] = excluded;
    if (excluded) {
      // Stop an already loaded tag too, including a preference changed in another tab.
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      return;
    }
    if (document.getElementById('tcl-google-tag')) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    // Follow the site's analytics preference; advertising consent stays denied.
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    // Navigation loads a new document. This single config owns its page_view;
    // do not also send manual page_view events or wrap the History API.
    window.gtag('config', measurementId, {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const tag = document.createElement('script');
    tag.id = 'tcl-google-tag';
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(tag);
  };

  syncGoogleAnalytics();
  addEventListener('storage', event => {
    if (event.key !== 'va-disable' && event.key !== null) return;
    try {
      disabled = localStorage.getItem('va-disable') === '1';
    } catch { /* Retain the current preference if storage becomes unavailable. */ }
    syncGoogleAnalytics();
  });

  if (options.vercel === 'true' && !isDisabled()) {
    const { inject } = await import('./vercel-analytics.js');
    // The preference can change while the local SDK module is loading.
    if (!isDisabled()) inject({
      mode: 'production',
      beforeSend(event) {
        return isDisabled() ? null : event;
      },
    });
  }
}

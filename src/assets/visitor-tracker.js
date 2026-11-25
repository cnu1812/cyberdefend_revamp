(() => {
  'use strict';

  const HOST_TO_SITE = {
    'cyberdefend.in': 'main',
    'www.cyberdefend.in': 'main',
    'academy.cyberdefend.in': 'academy',
    'services.cyberdefend.in': 'services'
  };

  const site = HOST_TO_SITE[location.hostname];
  if (!site) return;

  const CONSENT_KEY = 'cd_analytics_consent';
  const SESSION_COOKIE = 'cd_vt_sid';
  const PREV_PAGE_COOKIE = 'cd_vt_prev';
  const ENDPOINT = '/.netlify/functions/track';
  const ACTIVE_IDLE_MS = 30000;
  const SCROLL_MILESTONES = [25, 50, 75, 90];
  const FORM_MILESTONES = [25, 50, 75];

  const getCookie = name => {
    const prefix = name + '=';
    const match = document.cookie.split('; ').find(c => c.startsWith(prefix));
    return match ? match.slice(prefix.length) : '';
  };

  const hasConsent = () => getCookie(CONSENT_KEY) === 'accepted';

  const setSessionCookie = (name, value) => {
    document.cookie = `${name}=${value}; Path=/; Domain=cyberdefend.in; SameSite=Lax; Secure`;
  };

  const clearSessionCookie = name => {
    for (const domain of ['', '; Domain=cyberdefend.in', '; Domain=' + location.hostname]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax${domain}`;
    }
  };

  const uuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return '';
  };

  const cleanPath = value => {
    try {
      const u = new URL(value, location.origin);
      return u.pathname || '/';
    } catch {
      return '/';
    }
  };

  const cleanCyberDefendUrl = value => {
    try {
      const u = new URL(value);
      return HOST_TO_SITE[u.hostname] ? u.origin + (u.pathname || '/') : '';
    } catch {
      return '';
    }
  };

  const referrerHost = () => {
    if (!document.referrer) return '';
    try {
      return new URL(document.referrer).hostname || '';
    } catch {
      return '';
    }
  };

  const viewportType = () => {
    const w = window.innerWidth || document.documentElement?.clientWidth || 1024;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  };

  let sessionId = '';
  let started = false;
  let exited = false;
  let pageStart = Date.now();
  let lastActivity = Date.now();
  let activeMs = 0;
  let activeTimer = null;
  let maxScroll = 0;
  const firedScroll = new Set();

  // Form tracking state (never stores field values)
  let formEl = null;
  let formId = '';
  let formStarted = false;
  let formSubmitted = false;
  let lastFormMilestone = 0;
  const firedFormMilestones = new Set();

  const ensureSession = () => {
    if (!hasConsent()) return '';
    if (sessionId) return sessionId;
    const existing = getCookie(SESSION_COOKIE);
    if (existing && /^[-\w]{16,80}$/.test(existing)) {
      sessionId = existing;
      return sessionId;
    }
    sessionId = uuid();
    if (sessionId) setSessionCookie(SESSION_COOKIE, sessionId);
    return sessionId;
  };

  const clearState = () => {
    sessionId = '';
    started = false;
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    clearSessionCookie(SESSION_COOKIE);
    clearSessionCookie(PREV_PAGE_COOKIE);
  };

  const transmit = (payload, useBeacon = false) => {
    if (!hasConsent()) return false;
    const body = JSON.stringify(payload);
    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = typeof Blob === 'function' ? new Blob([body], { type: 'application/json' }) : body;
        if (navigator.sendBeacon(ENDPOINT, blob)) return true;
      } catch {
        // Fall back to fetch keepalive below.
      }
    }
    if (typeof fetch === 'function') {
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: useBeacon
        }).catch(() => {});
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const sendEvent = (event, metadata = {}, useBeacon = false) => {
    if (!hasConsent()) return false;
    const sid = ensureSession();
    const eid = uuid();
    if (!sid || !eid) return false;
    return transmit({
      event,
      eventId: eid,
      sessionId: sid,
      site,
      page: cleanPath(location.pathname),
      referrer: referrerHost(),
      timestamp: new Date().toISOString(),
      metadata
    }, useBeacon);
  };

  const getScrollPercent = () => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc?.scrollTop || body?.scrollTop || 0;
    const scrollHeight = Math.max(doc?.scrollHeight || 0, body?.scrollHeight || 0);
    const clientHeight = window.innerHeight || doc?.clientHeight || 0;
    const maxScrollable = Math.max(0, scrollHeight - clientHeight);
    if (maxScrollable <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((scrollTop / maxScrollable) * 100)));
  };

  const checkScroll = () => {
    if (!started || !hasConsent()) return;
    const pct = getScrollPercent();
    if (pct > maxScroll) maxScroll = pct;
    for (const m of SCROLL_MILESTONES) {
      if (pct >= m && !firedScroll.has(m)) {
        firedScroll.add(m);
        sendEvent('scroll_milestone', { scrollDepth: m });
      }
    }
  };

  const relevantFormFields = form => {
    if (!form || !form.elements) return [];
    return Array.from(form.elements).filter(el => {
      if (!el || !el.name) return false;
      if (el.name === 'website') return false; // honeypot
      const type = (el.type || '').toLowerCase();
      return !['hidden', 'submit', 'button', 'reset'].includes(type);
    });
  };

  const computeFormPercent = form => {
    const fields = relevantFormFields(form);
    if (!fields.length) return 0;
    let filled = 0;
    for (const el of fields) {
      const type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (el.checked) filled++;
      } else if (typeof el.value === 'string' && el.value.trim().length > 0) {
        filled++;
      }
    }
    return Math.round((filled / fields.length) * 100);
  };

  const handleFormInteraction = () => {
    if (!started || !hasConsent() || !formEl || formSubmitted) return;
    if (!formStarted) {
      formStarted = true;
      sendEvent('form_start', { formId, milestone: 'first_interaction' });
    }
    const pct = computeFormPercent(formEl);
    for (const m of FORM_MILESTONES) {
      if (pct >= m && !firedFormMilestones.has(m)) {
        firedFormMilestones.add(m);
        lastFormMilestone = m;
        sendEvent('form_progress', { formId, milestone: `${m}_percent`, completionPercent: m });
      }
    }
  };

  const initFormTracking = () => {
    formEl = document.querySelector('#enquiry-form') || document.querySelector('form');
    if (!formEl) return;
    formId = formEl.id || 'enquiry-form';
    if (started && hasConsent()) {
      sendEvent('form_progress', { formId, milestone: 'form_opened', completionPercent: 0 });
    }
  };

  const startTracking = () => {
    if (started || !hasConsent()) return;
    const isNewSession = !getCookie(SESSION_COOKIE);
    const sid = ensureSession();
    if (!sid) return;
    started = true;
    exited = false;
    pageStart = Date.now();
    lastActivity = Date.now();

    if (isNewSession) {
      sendEvent('visitor_session_start', { viewport: viewportType() });
    }

    const prevFromCookie = getCookie(PREV_PAGE_COOKIE);
    const refClean = cleanCyberDefendUrl(document.referrer);
    const previousPage = prevFromCookie || refClean || '';
    const refHost = referrerHost();
    const subdomainTransition = Boolean(refHost && HOST_TO_SITE[refHost] && refHost !== location.hostname);

    const viewMeta = { viewport: viewportType(), scrollDepth: 0 };
    if (previousPage) viewMeta.previousPage = previousPage;
    if (subdomainTransition) viewMeta.subdomainTransition = true;

    sendEvent('page_view', viewMeta);
    setSessionCookie(PREV_PAGE_COOKIE, location.origin + cleanPath(location.pathname));

    if (!activeTimer) {
      activeTimer = setInterval(() => {
        if (!hasConsent()) {
          clearState();
          return;
        }
        if (document.visibilityState !== 'hidden' && Date.now() - lastActivity <= ACTIVE_IDLE_MS) {
          activeMs += 1000;
        }
      }, 1000);
    }

    if (formEl && !formStarted && !formSubmitted) {
      sendEvent('form_progress', { formId, milestone: 'form_opened', completionPercent: 0 });
    }
  };

  const markActivity = () => {
    lastActivity = Date.now();
  };

  const handleExit = () => {
    if (exited || !started || !hasConsent()) return;
    exited = true;

    if (formEl && formStarted && !formSubmitted) {
      sendEvent('form_abandon', {
        formId,
        lastMilestone: lastFormMilestone ? `${lastFormMilestone}_percent` : 'first_interaction',
        completionPercent: lastFormMilestone
      }, true);
    }

    const timeOnPageMs = Math.max(0, Date.now() - pageStart);
    sendEvent('page_exit', {
      timeOnPageMs,
      activeEngagementMs: activeMs,
      maxScrollDepth: maxScroll
    }, true);

    sendEvent('session_end', {
      timeOnPageMs,
      activeEngagementMs: activeMs
    }, true);
  };

  // Activity and scroll listeners
  for (const evt of ['pointerdown', 'keydown', 'mousemove', 'touchstart']) {
    document.addEventListener(evt, markActivity, { passive: true });
  }
  window.addEventListener('scroll', () => {
    markActivity();
    checkScroll();
  }, { passive: true });

  // CTA click listeners (WhatsApp & Enquiry CTAs)
  document.addEventListener('click', e => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    const choiceBtn = target.closest('[data-choice]');
    if (choiceBtn) {
      if (choiceBtn.dataset.choice === 'accepted') startTracking();
      else clearState();
      return;
    }

    if (!hasConsent() || !started) return;

    const anchor = target.closest('a[href]');
    if (!anchor) return;
    try {
      const u = new URL(anchor.href, location.href);
      if (['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com'].includes(u.hostname)) {
        sendEvent('whatsapp_cta_click', { targetHost: u.hostname });
        return;
      }
      if (HOST_TO_SITE[u.hostname] && (u.pathname.startsWith('/contact') || anchor.classList.contains('nav-cta') || anchor.classList.contains('btn'))) {
        sendEvent('enquiry_cta_click', { targetPath: u.pathname || '/', targetSite: HOST_TO_SITE[u.hostname] });
      }
    } catch {
      // Ignore non-HTTP links (e.g. mailto:, tel:)
    }
  });

  // Form interaction and confirmed submission listeners
  document.addEventListener('focusin', e => {
    if (formEl && e.target && formEl.contains(e.target)) handleFormInteraction();
  });
  document.addEventListener('input', e => {
    if (formEl && e.target && formEl.contains(e.target)) handleFormInteraction();
  });
  document.addEventListener('change', e => {
    if (formEl && e.target && formEl.contains(e.target)) handleFormInteraction();
  });
  document.addEventListener('cyberdefend:enquiry-success', () => {
    if (!hasConsent() || !started) return;
    formSubmitted = true;
    sendEvent('form_submit', {
      formId: formId || 'enquiry-form',
      milestone: 'form_submitted',
      completionPercent: 100
    });
  });

  // Consent withdrawal across tabs/subdomains
  window.addEventListener('focus', () => {
    if (!hasConsent()) clearState();
    else if (!started) startTracking();
  });

  window.addEventListener('pagehide', handleExit);

  initFormTracking();
  if (hasConsent()) startTracking();
})();

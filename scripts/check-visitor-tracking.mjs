import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { trackEvent, resetRateLimits } from '../netlify/functions/track.mjs';

const trackerCode = fs.readFileSync('src/assets/visitor-tracker.js', 'utf8');

// 1. All three builds include visitor-tracker.js exactly once; Meta Pixel and GA4 remain intact.
for (const target of ['main', 'services', 'academy']) {
  const html = fs.readFileSync(`dist/${target}/index.html`, 'utf8');
  assert.equal((html.match(/src="\/assets\/visitor-tracker\.js"/g) || []).length, 1, `${target}: visitor-tracker.js once`);
  assert.equal((html.match(/src="\/assets\/analytics\.js"/g) || []).length, 1, `${target}: analytics.js intact`);
  const hasPixel = html.includes("fbq('init', '1174012865371617')");
  assert.equal(hasPixel, target !== 'services', `${target}: Meta Pixel intact`);
  const csp = fs.readFileSync(`dist/${target}/_headers`, 'utf8');
  assert(csp.includes("connect-src 'self'"), `${target}: CSP allows same-origin tracking`);
  assert(fs.existsSync(`dist/${target}/assets/visitor-tracker.js`), `${target}: visitor-tracker.js copied`);
}

// Helper to run visitor-tracker.js in a sandboxed DOM/browser fixture.
function createBrowserFixture({
  host = 'academy.cyberdefend.in',
  path = '/courses/ai-security?email=secret@example.com#token=123',
  referrer = 'https://cyberdefend.in/contact/?phone=9999999999#private',
  initialConsent = '',
  hasForm = true,
  withBeacon = true,
  beaconResult = true
} = {}) {
  const cookies = new Map();
  if (initialConsent) cookies.set('cd_analytics_consent', initialConsent);

  const docListeners = {};
  const winListeners = {};
  const sent = [];

  const formFields = hasForm
    ? [
        { name: 'name', type: 'text', value: '' },
        { name: 'email', type: 'email', value: '' },
        { name: 'topic', type: 'select-one', value: '' },
        { name: 'message', type: 'textarea', value: '' },
        { name: 'website', type: 'text', value: '' } // honeypot must be ignored
      ]
    : [];

  const formEl = hasForm
    ? {
        id: 'enquiry-form',
        elements: formFields,
        contains: node => formFields.includes(node) || node === formEl
      }
    : null;

  const document = {
    get cookie() {
      return Array.from(cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
    set cookie(raw) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) return;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (/Max-Age=0/i.test(raw)) cookies.delete(k);
      else cookies.set(k, v);
    },
    referrer,
    visibilityState: 'visible',
    documentElement: { scrollTop: 0, scrollHeight: 2000, clientHeight: 1000 },
    body: { scrollTop: 0, scrollHeight: 2000 },
    querySelector: sel => (sel === '#enquiry-form' || sel === 'form' ? formEl : null),
    addEventListener: (name, fn) => {
      docListeners[name] = docListeners[name] || [];
      docListeners[name].push(fn);
    }
  };

  const window = {
    innerWidth: 1280,
    innerHeight: 1000,
    scrollY: 0,
    addEventListener: (name, fn) => {
      winListeners[name] = winListeners[name] || [];
      winListeners[name].push(fn);
    }
  };

  const navigator = withBeacon
    ? {
        sendBeacon: (url, blobOrBody) => {
          const text = typeof blobOrBody === 'string' ? blobOrBody : blobOrBody.text;
          sent.push({ transport: 'beacon', url, body: JSON.parse(text) });
          return beaconResult;
        }
      }
    : {};

  const fetchMock = async (url, opts) => {
    sent.push({ transport: 'fetch', url, keepalive: Boolean(opts.keepalive), body: JSON.parse(opts.body) });
    return { ok: true, status: 202 };
  };

  class MockBlob {
    constructor(parts) {
      this.text = parts.join('');
    }
  }

  let uuidCounter = 0;
  const cryptoMock = {
    randomUUID: () => `11111111-1111-4111-8111-${String(++uuidCounter).padStart(12, '0')}`
  };

  const intervals = [];
  const context = {
    window,
    document,
    navigator,
    fetch: fetchMock,
    Blob: MockBlob,
    URL,
    crypto: cryptoMock,
    location: {
      hostname: host,
      origin: `https://${host}`,
      pathname: path.split(/[?#]/)[0],
      href: `https://${host}${path}`
    },
    setInterval: fn => {
      intervals.push(fn);
      return intervals.length;
    },
    clearInterval: () => {}
  };

  vm.runInNewContext(trackerCode, context);

  const emitDoc = (name, evt = {}) => (docListeners[name] || []).forEach(fn => fn(evt));
  const emitWin = (name, evt = {}) => (winListeners[name] || []).forEach(fn => fn(evt));

  return {
    sent,
    cookies,
    formFields,
    context,
    acceptConsent: () => {
      cookies.set('cd_analytics_consent', 'accepted');
      emitDoc('click', { target: { closest: sel => (sel === '[data-choice]' ? { dataset: { choice: 'accepted' } } : null) } });
    },
    withdrawConsent: () => {
      cookies.set('cd_analytics_consent', 'declined');
      emitDoc('click', { target: { closest: sel => (sel === '[data-choice]' ? { dataset: { choice: 'declined' } } : null) } });
    },
    scrollTo: y => {
      window.scrollY = y;
      emitWin('scroll');
    },
    clickLink: (href, classList = []) => {
      const anchor = {
        href,
        classList: { contains: c => classList.includes(c) }
      };
      emitDoc('click', {
        target: {
          closest: sel => (sel === 'a[href]' ? anchor : null)
        }
      });
    },
    emitDoc,
    emitWin
  };
}

// 2. No events are transmitted before analytics consent.
let f = createBrowserFixture({ initialConsent: '' });
assert.equal(f.sent.length, 0, 'Must not send events without consent');
assert(!f.cookies.has('cd_vt_sid'), 'Must not set session cookie without consent');

// 3. Events are transmitted after analytics consent + 6. Query strings & sensitive params stripped.
f.acceptConsent();
const eventNames = () => f.sent.map(x => x.body.event);
assert(eventNames().includes('visitor_session_start'), 'visitor_session_start sent after consent');
assert(eventNames().includes('page_view'), 'page_view sent after consent');
const pv = f.sent.find(x => x.body.event === 'page_view').body;
assert.equal(pv.site, 'academy');
assert.equal(pv.page, '/courses/ai-security');
assert.equal(pv.referrer, 'cyberdefend.in');
assert.equal(pv.metadata.previousPage, 'https://cyberdefend.in/contact/');
assert.equal(pv.metadata.subdomainTransition, true);
assert(!JSON.stringify(f.sent).includes('secret@example.com'), 'Query string email must be stripped');
assert(!JSON.stringify(f.sent).includes('9999999999'), 'Referrer query string phone must be stripped');
assert(!JSON.stringify(f.sent).includes('token=123'), 'Fragment must be stripped');

// Scroll milestones & CTA clicks
f.scrollTo(500);
assert(eventNames().includes('scroll_milestone'), 'scroll_milestone 50% fired');
f.clickLink('https://wa.me/918074426200?text=Hello');
assert(eventNames().includes('whatsapp_cta_click'), 'whatsapp_cta_click fired');
assert(!JSON.stringify(f.sent).includes('8074426200'), 'WhatsApp query/phone must not be in payload');
f.clickLink('https://cyberdefend.in/contact/?topic=Training', ['btn']);
assert(eventNames().includes('enquiry_cta_click'), 'enquiry_cta_click fired');

// 4. Consent withdrawal stops further tracking.
const countBeforeWithdraw = f.sent.length;
f.withdrawConsent();
assert(!f.cookies.has('cd_vt_sid'), 'Session cookie cleared on withdrawal');
f.scrollTo(900);
f.emitWin('pagehide');
assert.equal(f.sent.length, countBeforeWithdraw, 'No events sent after consent withdrawal');

// 5 & 7. Form milestones & zero PII in payloads, plus form_submit and form_abandon.
const fSubmit = createBrowserFixture({ initialConsent: 'accepted', host: 'cyberdefend.in', path: '/contact/' });
assert(fSubmit.sent.some(x => x.body.event === 'form_progress' && x.body.metadata.milestone === 'form_opened'));
fSubmit.formFields[0].value = 'Jane Sensitive';
fSubmit.emitDoc('focusin', { target: fSubmit.formFields[0] }); // 1/4 = 25%
assert(fSubmit.sent.some(x => x.body.event === 'form_start' && x.body.metadata.milestone === 'first_interaction'));
assert(fSubmit.sent.some(x => x.body.event === 'form_progress' && x.body.metadata.completionPercent === 25));
fSubmit.formFields[1].value = 'jane@private.example';
fSubmit.emitDoc('input', { target: fSubmit.formFields[1] }); // 2/4 = 50%
assert(fSubmit.sent.some(x => x.body.event === 'form_progress' && x.body.metadata.completionPercent === 50));
fSubmit.formFields[2].value = 'Corporate training';
fSubmit.emitDoc('change', { target: fSubmit.formFields[2] }); // 3/4 = 75%
assert(fSubmit.sent.some(x => x.body.event === 'form_progress' && x.body.metadata.completionPercent === 75));
fSubmit.emitDoc('cyberdefend:enquiry-success');
assert(fSubmit.sent.some(x => x.body.event === 'form_submit' && x.body.metadata.completionPercent === 100));
const serializedFormEvents = JSON.stringify(fSubmit.sent);
assert(!serializedFormEvents.includes('Jane Sensitive'), 'Form name value must never appear in events');
assert(!serializedFormEvents.includes('jane@private.example'), 'Form email value must never appear in events');
assert(!serializedFormEvents.includes('Corporate training'), 'Form topic value must never appear in events');

// Form abandon + 8. sendBeacon on page_exit + fetch fallback.
const fAbandon = createBrowserFixture({ initialConsent: 'accepted', host: 'cyberdefend.in', path: '/contact/', withBeacon: true });
fAbandon.formFields[0].value = 'Visitor';
fAbandon.emitDoc('input', { target: fAbandon.formFields[0] });
fAbandon.emitWin('pagehide');
const abandonEvt = fAbandon.sent.find(x => x.body.event === 'form_abandon');
const exitEvt = fAbandon.sent.find(x => x.body.event === 'page_exit');
const endEvt = fAbandon.sent.find(x => x.body.event === 'session_end');
assert(abandonEvt && abandonEvt.transport === 'beacon', 'form_abandon uses sendBeacon');
assert(exitEvt && exitEvt.transport === 'beacon', 'page_exit uses sendBeacon');
assert(endEvt && endEvt.transport === 'beacon', 'session_end uses sendBeacon');

const fFallback = createBrowserFixture({ initialConsent: 'accepted', withBeacon: false });
fFallback.emitWin('pagehide');
const fallbackExit = fFallback.sent.find(x => x.body.event === 'page_exit');
assert(fallbackExit && fallbackExit.transport === 'fetch' && fallbackExit.keepalive === true, 'page_exit falls back to fetch keepalive');

// 9–12. Backend endpoint tests (netlify/functions/track.mjs)
resetRateLimits();
const validEvent = {
  event: 'page_view',
  eventId: '11111111-1111-4111-8111-000000000001',
  sessionId: '22222222-2222-4222-8222-000000000001',
  site: 'academy',
  page: '/courses/ai-security',
  referrer: 'cyberdefend.in',
  timestamp: new Date().toISOString(),
  metadata: { viewport: 'desktop', scrollDepth: 0 }
};

const makeReq = (body, { origin = 'https://academy.cyberdefend.in', method = 'POST', contentType = 'application/json', ip = '203.0.113.10' } = {}) =>
  new Request('https://academy.cyberdefend.in/.netlify/functions/track', {
    method,
    headers: { origin, 'content-type': contentType, 'x-nf-client-connection-ip': ip },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });

// Valid event accepted (202 without storage webhook)
const okRes = await trackEvent(makeReq(validEvent));
assert.equal(okRes.status, 202);
assert.equal((await okRes.json()).stored, false);

// text/plain sendBeacon compatibility
assert.equal((await trackEvent(makeReq(validEvent, { contentType: 'text/plain;charset=UTF-8' }))).status, 202);

// 9. Invalid origins rejected
assert.equal((await trackEvent(makeReq(validEvent, { origin: 'https://evil.example' }))).status, 403);
assert.equal((await trackEvent(makeReq(validEvent, { origin: '' }))).status, 403);

// 10. Invalid payloads rejected
assert.equal((await trackEvent(makeReq('not-json'))).status, 400);
assert.equal((await trackEvent(makeReq({ ...validEvent, event: 'unknown_event' }))).status, 400);
assert.equal((await trackEvent(makeReq({ ...validEvent, site: 'unknown' }))).status, 400);
assert.equal((await trackEvent(makeReq({ ...validEvent, page: '/contact/?email=a@b.com' }))).status, 400);
assert.equal((await trackEvent(makeReq({ ...validEvent, metadata: { email: 'a@b.com' } }))).status, 400);
assert.equal((await trackEvent(makeReq({ ...validEvent, metadata: { note: 'contact me at user@example.com' } }))).status, 400);

// 11. Oversized payloads rejected
assert.equal((await trackEvent(makeReq({ ...validEvent, metadata: { extra: 'x'.repeat(9000) } }))).status, 413);

// 12. Rate limiting behaves as expected
resetRateLimits();
for (let i = 0; i < 3; i++) {
  assert.equal((await trackEvent(makeReq(validEvent, { ip: '198.51.100.5' }), { rateLimit: 3 })).status, 202);
}
assert.equal((await trackEvent(makeReq(validEvent, { ip: '198.51.100.5' }), { rateLimit: 3 })).status, 429);

console.log('PASS: unified visitor tracker (consent, PII safety, milestones, sendBeacon/fetch, origin/payload/size/rate-limit validation).');

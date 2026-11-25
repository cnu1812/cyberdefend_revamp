const APPROVED_ORIGINS = new Set([
  'https://cyberdefend.in',
  'https://www.cyberdefend.in',
  'https://academy.cyberdefend.in',
  'https://services.cyberdefend.in'
]);

const ALLOWED_EVENTS = new Set([
  'visitor_session_start',
  'page_view',
  'page_exit',
  'session_end',
  'scroll_milestone',
  'whatsapp_cta_click',
  'enquiry_cta_click',
  'form_start',
  'form_progress',
  'form_abandon',
  'form_submit'
]);

const ALLOWED_SITES = new Set(['main', 'academy', 'services']);
const PII_KEY_PATTERN = /^(?:email|phone|tel|name|fullName|firstName|lastName|password|message|secret|token|address|value|input)$/i;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const ID_PATTERN = /^[-\w]{16,80}$/;
const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = 60;

const rateBuckets = new Map();

const reply = (status, body) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });

export const config = {
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rate_limit' }
};

function checkRateLimit(key, now = Date.now(), limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= limit;
}

export function resetRateLimits() {
  rateBuckets.clear();
}

function validateMetadata(meta) {
  if (meta == null) return { ok: true, value: {} };
  if (typeof meta !== 'object' || Array.isArray(meta)) return { ok: false };
  const entries = Object.entries(meta);
  if (entries.length > 12) return { ok: false };
  const clean = {};
  for (const [k, v] of entries) {
    if (typeof k !== 'string' || k.length > 40 || PII_KEY_PATTERN.test(k)) return { ok: false };
    if (typeof v === 'string') {
      if (v.length > 150 || v.includes('?') || EMAIL_PATTERN.test(v)) return { ok: false };
      clean[k] = v;
    } else if (typeof v === 'number') {
      if (!Number.isFinite(v)) return { ok: false };
      clean[k] = v;
    } else if (typeof v === 'boolean') {
      clean[k] = v;
    } else {
      return { ok: false };
    }
  }
  return { ok: true, value: clean };
}

export async function trackEvent(request, { env = () => '', send = fetch, now = () => Date.now(), rateLimit = RATE_LIMIT } = {}) {
  if (request.method !== 'POST') {
    return reply(405, { ok: false, message: 'Method not allowed.' });
  }

  const origin = request.headers.get('origin') || '';
  if (!APPROVED_ORIGINS.has(origin)) {
    return reply(403, { ok: false, message: 'Origin not permitted.' });
  }

  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json') && !contentType.startsWith('text/plain')) {
    return reply(415, { ok: false, message: 'Unsupported content type.' });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return reply(413, { ok: false, message: 'Payload too large.' });
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, message: 'Malformed JSON payload.' });
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reply(400, { ok: false, message: 'Invalid event object.' });
  }

  const { event, eventId, sessionId, site, page, referrer = '', timestamp, metadata } = input;

  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return reply(400, { ok: false, message: 'Invalid event name.' });
  }
  if (typeof eventId !== 'string' || !ID_PATTERN.test(eventId)) {
    return reply(400, { ok: false, message: 'Invalid eventId.' });
  }
  if (typeof sessionId !== 'string' || !ID_PATTERN.test(sessionId)) {
    return reply(400, { ok: false, message: 'Invalid sessionId.' });
  }
  if (typeof site !== 'string' || !ALLOWED_SITES.has(site)) {
    return reply(400, { ok: false, message: 'Invalid site.' });
  }
  if (
    typeof page !== 'string' ||
    !page.startsWith('/') ||
    page.length > 200 ||
    page.includes('?') ||
    page.includes('#') ||
    EMAIL_PATTERN.test(page)
  ) {
    return reply(400, { ok: false, message: 'Invalid page path.' });
  }
  if (
    typeof referrer !== 'string' ||
    referrer.length > 120 ||
    referrer.includes('://') ||
    referrer.includes('?') ||
    referrer.includes('#') ||
    referrer.includes('/') ||
    EMAIL_PATTERN.test(referrer)
  ) {
    return reply(400, { ok: false, message: 'Invalid referrer.' });
  }
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
    return reply(400, { ok: false, message: 'Invalid timestamp.' });
  }

  const metaCheck = validateMetadata(metadata);
  if (!metaCheck.ok) {
    return reply(400, { ok: false, message: 'Invalid metadata.' });
  }

  const clientIp = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || origin;
  if (!checkRateLimit(`${clientIp}:${sessionId}`, now(), rateLimit)) {
    return reply(429, { ok: false, message: 'Rate limit exceeded.' });
  }

  const sanitized = {
    event,
    eventId,
    sessionId,
    site,
    page,
    referrer,
    timestamp: new Date(timestamp).toISOString(),
    metadata: metaCheck.value
  };

  const sinkUrl = env('VISITOR_TRACKING_WEBHOOK_URL');
  const sinkSecret = env('VISITOR_TRACKING_SECRET');
  if (sinkUrl && /^https:\/\/[-\w.]+(?:\/.*)?$/.test(sinkUrl)) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sinkSecret) headers['X-Tracking-Secret'] = sinkSecret;
      const res = await send(sinkUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(sanitized),
        signal: AbortSignal.timeout(5000)
      });
      if (res && res.ok) {
        return reply(200, { ok: true, accepted: true, stored: true, eventId });
      }
    } catch {
      // Do not fail visitor telemetry if optional storage sink times out.
    }
  }

  return reply(202, { ok: true, accepted: true, stored: false, eventId });
}

export default request =>
  trackEvent(request, {
    env: key => (typeof Netlify !== 'undefined' ? Netlify.env.get(key) : '')
  });

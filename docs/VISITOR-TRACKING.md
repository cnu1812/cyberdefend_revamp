# Unified, Privacy-First Visitor Tracking (Phase 1)

This document describes CyberDefend's lightweight first-party visitor activity tracking system shared across all three websites:

- `https://cyberdefend.in/` (`main`)
- `https://academy.cyberdefend.in/` (`academy`)
- `https://services.cyberdefend.in/` (`services`)

---

## 1. Architecture

```
Browser (src/assets/visitor-tracker.js)
  │  Checks cd_analytics_consent === 'accepted'
  │  Tracks navigation, engagement, scroll, CTAs, form milestones
  │  Strips query strings, fragments, and form values
  ▼
POST /.netlify/functions/track (netlify/functions/track.mjs)
  │  Validates method, approved Origin, Content-Type, 8 KB size limit
  │  Validates schema, rejects PII keys/emails/query strings
  │  Applies rate limiting (60 req/min)
  ▼
Optional Storage Webhook (VISITOR_TRACKING_WEBHOOK_URL)
  │  When unset: returns HTTP 202 { ok: true, accepted: true, stored: false }
  │  When set: forwards sanitized JSON event and returns HTTP 200 { stored: true }
```

All three Netlify sites are built from `scripts/build.mjs`, which includes `/assets/visitor-tracker.js` once per page and deploys `netlify/functions/track.mjs` alongside `contact.mjs` without altering the contact form, GA4, Meta Pixel, or Meta CAPI workflows.

---

## 2. Events & Schema

### Event Payload Schema

```json
{
  "event": "page_view",
  "eventId": "uuid",
  "sessionId": "uuid",
  "site": "academy",
  "page": "/courses/ai-security",
  "referrer": "cyberdefend.in",
  "timestamp": "2026-11-26T00:00:00.000Z",
  "metadata": {
    "viewport": "desktop",
    "scrollDepth": 0
  }
}
```

- `site`: strictly `"main"`, `"academy"`, or `"services"`.
- `page`: pathname only (query strings and hash fragments stripped).
- `referrer`: hostname only (no paths, query strings, or tokens).

### Tracked Events

| Category | Event Name | Trigger & Key Metadata |
|---|---|---|
| **Visitor** | `visitor_session_start` | First consented page load in a session (`viewport`) |
| | `page_view` | Consented page load (`viewport`, `scrollDepth`, optional `previousPage`, `subdomainTransition`) |
| | `page_exit` | `pagehide` via `sendBeacon` / `fetch` keepalive (`timeOnPageMs`, `activeEngagementMs`, `maxScrollDepth`) |
| | `session_end` | `pagehide` via `sendBeacon` / `fetch` keepalive (`timeOnPageMs`, `activeEngagementMs`) |
| **Engagement** | `scroll_milestone` | `25`, `50`, `75`, `90` percent scroll depth (once per milestone per page) |
| | `whatsapp_cta_click` | Click on `wa.me` / `whatsapp.com` CTA (`targetHost` only) |
| | `enquiry_cta_click` | Click on internal contact/CTA link (`targetPath`, `targetSite`) |
| **Form** | `form_start` | First interaction with form (`formId`, `milestone: "first_interaction"`) |
| | `form_progress` | `form_opened` (0%), `25_percent`, `50_percent`, `75_percent` |
| | `form_submit` | Confirmed submission via `cyberdefend:enquiry-success` (`completionPercent: 100`) |
| | `form_abandon` | `pagehide` after `form_start` without `form_submit` (`lastMilestone`, `completionPercent`) |

---

## 3. Consent & Privacy Safeguards

- **Reuses existing consent**: Reads the cross-subdomain `cd_analytics_consent` cookie managed by `src/assets/analytics.js`.
- **Zero pre-consent tracking**: No `sessionId` cookie (`cd_vt_sid`), no `cd_vt_prev` cookie, and no network requests are created until `cd_analytics_consent === 'accepted'`.
- **Immediate withdrawal**: Clicking *Reject analytics* (`[data-choice="declined"]`) or returning to a tab where consent was withdrawn immediately clears `cd_vt_sid` and `cd_vt_prev` and stops all tracking (including `page_exit` and `form_abandon`).
- **No fingerprinting**: `sessionId` and `eventId` use `crypto.randomUUID()` (random first-party UUIDs).
- **No PII**: Form field values are never read or transmitted; only non-empty field counts are used to compute completion percentages. The honeypot field (`website`) is excluded.
- **Endpoint hardening**: `netlify/functions/track.mjs` rejects unapproved origins (`403`), non-POST (`405`), oversized payloads > 8 KB (`413`), malformed/PII payloads (`400`), and excessive bursts (`429`).

---

## 4. Storage Configuration & Limitations

- Netlify Functions are stateless; `netlify/functions/track.mjs` does **not** use in-memory variables as permanent storage.
- Without external storage configured, `track.mjs` validates and accepts events with HTTP `202` (`stored: false`).
- To persist events later without modifying `Code.gs` or the BDA spreadsheet, configure optional Netlify environment variables on each project:
  - `VISITOR_TRACKING_WEBHOOK_URL` — HTTPS endpoint for a dedicated tracking sink (e.g., a separate Apps Script or log drain).
  - `VISITOR_TRACKING_SECRET` — optional shared secret sent as `X-Tracking-Secret`.

---

## 5. Testing & Verification

Run the full build and validation suite (including `scripts/check-visitor-tracking.mjs`):

```sh
npm test
```

To verify on each deployed website:
1. Open the site with DevTools Network tab open — confirm **no** requests to `/.netlify/functions/track` occur before accepting analytics.
2. Click **Accept analytics** — confirm `visitor_session_start` and `page_view` are sent to `/.netlify/functions/track` with `site` matching `main`, `academy`, or `services`.
3. Navigate across subdomains (e.g. `cyberdefend.in` → `academy.cyberdefend.in`) — confirm `sessionId` persists and `subdomainTransition: true` is recorded.
4. Click **Analytics preferences** → **Reject analytics** — confirm `cd_vt_sid` is deleted and no further events fire.

---

## 6. Disabling the Tracker Safely

To disable visitor tracking without affecting GA4, Meta Pixel, or the contact form:
1. Remove `<script src="/assets/visitor-tracker.js" defer></script>` from `shell()` in `scripts/build.mjs`.
2. Run `npm test` (update `scripts/check-visitor-tracking.mjs` if removing permanently) and redeploy.

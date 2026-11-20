# CyberDefend Revamp — Agent Intelligence

> **Purpose**: This file is the single source of truth for any AI agent working on this codebase. Read this before touching code. It describes architecture, conventions, data flows, every file's role, and the rules that must not be broken.

## Project identity

CyberDefend is a Bengaluru cybersecurity company. This repository is a **zero-dependency static site generator** built with pure Node.js (≥22). It produces static HTML for three Netlify-hosted domains from a single codebase. There are no npm packages, no frameworks, and no `node_modules`.

## Domains and routing

| Domain | Variable | Pages | Content |
|---|---|---|---|
| `cyberdefend.in` | `main` | 11 | Homepage, contact, privacy, terms, careers (hub + 6 role pages), talent solutions |
| `services.cyberdefend.in` | `services` | 7 | Services hub, VAPT, awareness, advisory, talent, corporate training cross-link, careers redirect |
| `academy.cyberdefend.in` | `academy` | 43 | Academy hub, programmes, labs, internships, certifications, corporate/college training, security engineering programme, 3 legacy courses, blog (26 current posts + archived articles), resources, careers redirect |

Routes are defined in the `defs` object in `scripts/build.mjs` as `[domain, path]` tuples:
```
defs.home       = ['main', '']
defs.services   = ['services', '']
defs.academy    = ['academy', '']
defs.vapt       = ['services', 'vapt/']
defs.programmes = ['academy', 'programmes/']
```
Additional routes are registered dynamically by content modules (`addCareers`, `addTalent`, `addTraining`, `addLegacyPages`, `addCurrentPosts`, `addAcademyProgramme`).

The `link(key)` function resolves routes: in preview mode (`SITE=all`), domains become path prefixes (`/academy/programmes/`); in domain builds, they resolve to full URLs (`https://academy.cyberdefend.in/programmes/`).

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Runs `scripts/build.mjs`. Builds all four outputs: `dist/main`, `dist/services`, `dist/academy`, `dist/preview` |
| `npm run check` | Runs 6 validation scripts in sequence (see Validation section) |
| `npm test` | Build + check |
| `npm run preview` | Starts a local HTTP server at `http://127.0.0.1:4173` serving `dist/preview` |

**Always run `npm test` after any change.** All 6 checks must pass.

## Repository structure

```
├── scripts/
│   ├── build.mjs              # Main build orchestrator, shared components (nav, footer, shell), page definitions
│   ├── serve.mjs              # Local HTTP server (port 4173, serves dist/preview)
│   ├── netlify-build.mjs      # Netlify entry point: selects domain via SITE_TARGET env var
│   ├── check.mjs              # Check 1: HTML structure, internal links, JSON-LD, contrast
│   ├── check-seo.mjs          # Check 2: Redirects, sitemaps, canonical URLs, unique titles
│   ├── check-contact.mjs      # Check 3: Contact form function + Apps Script integration tests
│   ├── check-blog.mjs         # Check 4: Blog post validation, rendering, XSS safety
│   ├── check-analytics.mjs    # Check 5: GA4 consent flow, event safety, ads.txt
│   └── portable-preview.mjs   # Creates a portable archive with inline assets
├── src/
│   ├── home.mjs               # Homepage editorial layout and hero
│   ├── training.mjs           # 8 training domains + corporate/college training pages
│   ├── academy-programme.mjs  # 40-hour "Advanced Security Engineering & AI Security" flagship programme
│   ├── careers.mjs            # 6 career roles with detail pages
│   ├── talent.mjs             # IT staff augmentation / talent solutions
│   ├── legacy.mjs             # Archived articles, 3 legacy course pages, careers/case-studies redirects
│   ├── current-posts.mjs      # Blog engine: validates JSON posts, renders articles with source citations
│   ├── seo.mjs                # JSON-LD structured data (Organization, WebSite, BreadcrumbList, WebPage, Service, Course, BlogPosting)
│   ├── data/
│   │   ├── site.json          # Company name, email, office URL, social links
│   │   ├── current-posts.json # Blog articles (structured JSON with blocks, sources, metadata)
│   │   ├── legacy-articles.json # Archived articles (raw HTML)
│   │   ├── redirects.json     # Legacy route mappings per domain
│   │   └── ads.txt            # Google AdSense seller authorisation (MUST have Unix \n line endings)
│   └── assets/
│       ├── style.css          # Base design system: CSS custom properties, layout, responsive grid
│       ├── refinement.css     # Manrope font faces, homepage premium hero, service visuals, contact layout
│       ├── programme.css      # Academy programme page styles (curriculum, platforms, capstone)
│       ├── careers.css        # Careers page styles (roles, manifesto, detail pages)
│       ├── blog.css           # Blog article styles (copy, tables, sources, table of contents)
│       ├── analytics.css      # Cookie consent banner styles
│       ├── site.js            # Client-side: mobile nav toggle, learning-area filters, contact form submission, URL param handling
│       ├── analytics.js       # GA4 with consent management, WhatsApp click tracking, clean URL sanitisation
│       ├── logo.svg, symbol.svg, favicon.ico, apple-touch-icon.png, social-card.png/svg
│       └── manrope-{400,600,700}.woff  # Self-hosted Manrope typeface
├── netlify/
│   └── functions/
│       └── contact.mjs        # Netlify serverless function: validates, forwards to Apps Script
├── integrations/
│   └── google-apps-script/
│       └── Code.gs            # Google Apps Script: saves enquiries to Google Sheet with deduplication
├── docs/
│   ├── DEPLOYMENT.md          # GitHub → Netlify → custom domain cutover guide
│   └── CONTENT-SOURCES.md     # Verified content inputs
├── dist/                      # Build output (gitignored)
├── netlify.toml               # Netlify build config (command, publish dir, Node 22)
├── package.json               # Zero-dependency, type: module, Node ≥22
└── .env.example               # SITE=all, PRODUCTION=false
```

## Build architecture

```
build.mjs (SITE=all by default)
├── Spawns child processes for SITE=main, SITE=services, SITE=academy
│   Each child builds its domain-specific output to dist/{domain}
├── Then builds dist/preview with all 61 pages merged
│
│ For each page:
│   1. Content modules register routes in `defs` and HTML in `pages`
│   2. shell(key, page) wraps content in full HTML document
│      └── <head>: meta, canonical, OG, Twitter, fonts, CSS, analytics, JSON-LD
│      └── <body>: skip link, topline, header/nav, <main>{page.body}</main>, footer
│   3. Output: dist/{target}/{route}/index.html
│
│ Also generates per-target:
│   - 404.html, sitemap.xml, robots.txt, _headers (CSP, security), _redirects
```

## Content module contract

Each content module exports an `add*` function that receives shared utilities:
```js
// Always receives:
{ defs, pages, link, btn, ... }

// Module must:
// 1. Register routes:  defs.myPage = ['domain', 'path/']
// 2. Register content: pages.myPage = { title, description, body, [noindex], [article], [styles] }
```

Page properties:
- `title` (string): Used in `<title>` and OG tags
- `description` (string): Meta description and OG description
- `body` (string): Raw HTML for `<main>`
- `noindex` (boolean, optional): Excludes from sitemap, adds noindex robots tag
- `article` (object, optional): `{ datePublished, dateModified, category, sources }` — triggers BlogPosting schema
- `styles` (string[], optional): Additional CSS files to include (e.g., `['blog.css']`)

## Shared UI components (defined in build.mjs)

| Function | Purpose |
|---|---|
| `icon(name)` | SVG icon (shield, learn, lab, award, arrow, pin, people) |
| `btn(text, key, secondary?, query?)` | CTA button linking to a page or WhatsApp |
| `textLink(text, key)` | Inline text link with arrow |
| `section(body, cls?)` | `<section>` wrapper with container; `cls='soft'` adds grey background |
| `head(eyebrow, title, desc?)` | Section heading with eyebrow label |
| `pageHero(eyebrow, title, desc, buttons?)` | Page hero with breadcrumbs |
| `steps(items)` | Numbered step list |
| `faq(items)` | Expandable FAQ `<details>` list |
| `cta(title, desc, topic?)` | Call-to-action strip with WhatsApp button |
| `tile(name, desc, key, icon?, meta?)` | Card component |
| `visual(kind?)` | Decorative visual block (main or lab variant) |
| `whatsappButton(query?)` | Direct WhatsApp link button |
| `esc(string)` | HTML entity escaping (`&`, `<`, `"`) — **always use for user/data content** |

## Contact form pipeline

```
Browser form → site.js (client validation, requestId, dedup)
  → POST /.netlify/functions/contact (Netlify Function)
    → Validates fields, checks honeypot, verifies origin
    → POST to Google Apps Script (with shared secret)
      → Apps Script validates, checks duplicate requestId
      → Appends row to Google Sheet (with formula injection protection)
      → Returns { ok: true, requestId }
    → Returns confirmed success to browser
  → site.js shows success/error message
  → analytics.js fires generate_lead event (if consent given)
```

Environment variables for contact form (Netlify):
- `CONTACT_APPS_SCRIPT_URL`: Google Apps Script web app URL
- `CONTACT_SHARED_SECRET`: Shared secret for server-to-server auth

## Blog system (current-posts.mjs)

Blog posts live in `src/data/current-posts.json` as structured JSON:
```json
{
  "slug": "lowercase-hyphenated",
  "title": "Article Title",
  "description": "Meta description",
  "summary": "Lead paragraph",
  "author": "CyberDefend",           // MUST be "CyberDefend"
  "datePublished": "YYYY-MM-DD",      // IST date, not future
  "dateModified": "YYYY-MM-DD",       // ≥ datePublished, not future
  "category": "Topic area",
  "sources": [                         // ≥ 2 required
    { "id": "ref_id", "title": "Source Title", "url": "https://..." }
  ],
  "blocks": [                          // Content blocks
    { "type": "heading", "id": "section-id", "text": "Section Title" },
    { "type": "paragraph", "content": [{ "text": "...", "source": "ref_id" }] },
    { "type": "list", "items": [[{ "text": "..." }]] },
    { "type": "table", "caption": "...", "headers": [...], "rows": [[...]] }
  ]
}
```

Validation rules enforced by `validatePosts()`:
- Slugs: lowercase alphanumeric with hyphens, unique across current + legacy
- One article per calendar date (IST)
- Dates must be chronological and not future
- Sources: ≥2, public HTTPS URLs, unique IDs
- Blocks: only heading/paragraph/list/table (no raw HTML — XSS prevention)
- Word count: ≥300
- Author must be "CyberDefend"

## CSS architecture

| File | Scope |
|---|---|
| `style.css` | Design system: custom properties (--ink, --teal, --mint, etc.), typography, grid, responsive breakpoints. Base for all pages |
| `refinement.css` | Manrope font faces, premium homepage hero, editorial sections, mobile-specific overrides |
| `programme.css` | Security engineering programme page, curriculum accordions, platform list, capstone steps |
| `careers.css` | Careers hub, role cards, manifesto aside, detail pages, application panels |
| `blog.css` | Article typography, table of contents, source lists, responsive tables |
| `analytics.css` | Cookie consent banner positioning and styling |

CSS custom properties (defined in `style.css :root`):
```css
--ink: #172d35      /* Primary text */
--muted: #52686d    /* Secondary text */
--paper: #fcfdfb    /* Background */
--soft: #eef3ef     /* Section backgrounds */
--line: #d5e1db     /* Borders */
--teal: #076d65     /* Brand accent, links, icons */
--mint: #d6ebe0     /* Highlight backgrounds */
--lime: #dcedab     /* Accent detail */
--white: #fff
--radius: 6px
```

## Analytics (analytics.js)

- GA4 property: `G-BFH57PLZRQ`
- Only loads on production hostnames (`cyberdefend.in`, `www.cyberdefend.in`, `academy.cyberdefend.in`, `services.cyberdefend.in`)
- Cookie consent banner with accept/reject
- Consent stored as `cd_analytics_consent` cookie (6 months, `.cyberdefend.in` domain)
- URL sanitisation: strips query strings and fragments before sending to GA
- Events tracked: `whatsapp_click`, `generate_lead` (form success)
- No PII in analytics events
- Respects withdrawal across subdomains via `focus` event listener

## Validation pipeline (6 checks)

All checks must pass. Run with `npm run check`.

1. **check.mjs**: 126 HTML pages across all targets. Validates: single `<h1>`, no placeholder text, all internal `href`/`src` resolve to existing files, fragment IDs exist, JSON-LD has Organization node, text contrast ratios ≥ 4.5:1

2. **check-seo.mjs**: Tests all redirect rules from `redirects.json` (46 cases). Validates: redirect chains ≤ 2 hops, query string preservation, canonical URLs match, unique page titles, sitemap entries match existing pages, breadcrumb schema, careers/case-studies excluded from non-main sitemaps

3. **check-contact.mjs**: Integration tests for `netlify/functions/contact.mjs` and `integrations/google-apps-script/Code.gs`. Tests: validation, missing config, upstream failures, success flow, deduplication via requestId, spreadsheet formula injection protection (`safe_()`)

4. **check-blog.mjs**: Validates all current posts via `validatePosts()`. Tests: BlogPosting schema, canonical URLs, OG article type, date rendering, word count, XSS prevention (hostile title/source rendering), archive preservation

5. **check-analytics.mjs**: Runs analytics.js in a VM sandbox. Tests: consent default denied, no scripts on non-production hosts, accept/reject flow, re-acceptance doesn't reload script, event suppression when declined, URL sanitisation (no secrets leaked), WhatsApp tracking, ads.txt content

6. Each check prints `PASS: ...` with counts

## Deployment (Netlify)

The same repo connects to 3 Netlify projects. Each sets `SITE_TARGET` env var.

```
netlify-build.mjs
├── Reads SITE_TARGET (main|services|academy|preview)
├── Sets PRODUCTION=true only when CONTEXT=production AND LAUNCH_APPROVED=true
├── Runs build.mjs with SITE={target}
└── Copies dist/{target} → dist/deploy (Netlify publish dir)
```

**Currently noindex by default.** To enable indexing: set `LAUNCH_APPROVED=true` in production context.

## Rules for agents

### Never break
- Zero dependencies: do not add `node_modules` or any npm packages
- All 6 checks must pass after any change
- `ads.txt` must have Unix `\n` line endings (not `\r\n`)
- Blog posts must have `author: "CyberDefend"` (not individual names)
- Blog post dates must not be in the future (Asia/Kolkata timezone)
- One blog post per calendar date
- Blog sources must be public HTTPS URLs (≥2 per article)
- Blog blocks: only `heading`, `paragraph`, `list`, `table` (no `html` type — XSS prevention)
- Always use `esc()` for data-driven content in HTML
- Contact form honeypot field (`website`) must remain and be checked
- WhatsApp number: +91 8074426200
- Email: support@cyberdefend.in
- No founder profiles or invented testimonials

### Style conventions
- ES modules (`type: "module"` in package.json)
- Template literals for HTML generation (not JSX, not template engines)
- Minified CSS (single-line per ruleset)
- Functions and variables: camelCase
- Page keys in `defs`/`pages`: camelCase (e.g., `corporateTraining`, `securityEngineering`)
- Slugs in URLs: lowercase-hyphenated (e.g., `security-engineering-ai-security`)
- File encoding: UTF-8

### When adding a new page
1. Register the route: `defs.myPage = ['domain', 'path/']`
2. Register the content: `pages.myPage = { title, description, body }`
3. Add to navigation if appropriate (nav array in `shell()`)
4. Add redirects in `redirects.json` if replacing old URLs
5. Update check counts if checks assert specific numbers (e.g., career count in `check-seo.mjs`)
6. Run `npm test`

### When adding a blog post
1. Add to `src/data/current-posts.json` array
2. Must follow the structured JSON format (see Blog system section)
3. Must have ≥2 HTTPS sources, ≥300 words, unique slug
4. Date must be today or earlier (IST)
5. Only one new post per calendar date
6. Run `npm test`

### When adding a career role
1. Add to the `roles` array in `src/careers.mjs`
2. Required fields: `slug`, `title`, `fullTitle`, `group` (experienced|internships|freelance), `tasks[]`, `eligibility`, `overview`, `skills`
3. Optional: `immediate: true` for urgent hiring
4. Update the careers count assertion in `check-seo.mjs` (line matching career sitemap URLs)
5. Add a redirect in `redirects.json` if removing a role
6. Run `npm test`

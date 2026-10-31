import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code = fs.readFileSync('src/assets/analytics.js', 'utf8');
function fixture(host = 'cyberdefend.in', initial = '') {
  let cookie = initial;
  const events = {}, scripts = [], panels = [];
  const panel = { setAttribute() {}, querySelector: () => ({ focus() {} }), addEventListener(n, fn) { this[n] = fn; } };
  const document = {
    get cookie() { return cookie; }, set cookie(v) { cookie = v.split(';')[0]; },
    referrer: 'https://example.com/page?email=private#secret',
    createElement: tag => tag === 'section' ? panel : {},
    head: { append: s => scripts.push(s) }, body: { append: p => panels.push(p) },
    querySelector: () => ({ addEventListener() {}, focus() {} }),
    addEventListener: (n, fn) => { events[n] = fn; }
  };
  const window = { addEventListener() {} };
  vm.runInNewContext(code, { window, document, URL, location: { hostname: host, href: 'https://' + host + '/contact/?email=private#secret' } });
  return { window, events, scripts, panel, choose: value => panel.click({ target: { closest: () => ({ dataset: { choice: value } }) } }) };
}
let f = fixture();
assert.equal(f.scripts.length, 0);
f.events['cyberdefend:enquiry-success']();
assert.equal(f.window.dataLayer.filter(a => a[0] === 'event').length, 0);
f.choose('accepted');
assert.equal(f.scripts.length, 1);
const config = f.window.dataLayer.find(a => a[0] === 'config');
assert.equal(config[1], 'G-BFH57PLZRQ');
assert.equal(config[2].page_location, 'https://cyberdefend.in/contact/');
assert.equal(config[2].page_referrer, 'https://example.com/page');
f.events['cyberdefend:enquiry-success']();
f.events.click({ target: { closest: () => ({ href: 'https://api.whatsapp.com/send?phone=918074426200&text=secret' }) } });
assert.deepEqual(Array.from(f.window.dataLayer.filter(a => a[0] === 'event'), a => a[1]), ['generate_lead', 'whatsapp_click']);
assert(!JSON.stringify(f.window.dataLayer).includes('secret'));
f.choose('declined');
assert.equal(f.window['ga-disable-G-BFH57PLZRQ'], true);
const count = f.window.dataLayer.length;
f.events['cyberdefend:enquiry-success']();
assert.equal(f.window.dataLayer.length, count);
f.choose('accepted');
assert.equal(f.scripts.length, 1);
assert.equal(fixture('localhost').scripts.length, 0);
assert.equal(fixture('academy.cyberdefend.in', 'cd_analytics_consent=accepted').scripts.length, 1);
assert.equal(fixture('services.cyberdefend.in', 'cd_analytics_consent=declined').scripts.length, 0);
for (const target of ['main', 'services', 'academy']) {
  const html = fs.readFileSync(`dist/${target}/index.html`, 'utf8');
  assert.equal((html.match(/src="\/assets\/analytics.js"/g) || []).length, 1);
  assert(html.includes('data-analytics-settings'));
  const head = html.split('</head>')[0];
  assert.equal((head.match(/<meta name="google-adsense-account" content="ca-pub-1656597464906448">/g) || []).length, target === 'services' ? 0 : 1);
  assert(!html.includes('pagead2.googlesyndication.com'));
  assert(fs.readFileSync(`dist/${target}/_headers`, 'utf8').includes('https://www.googletagmanager.com'));
}
console.log('PASS: analytics consent, withdrawal, reacceptance, safe event payloads, preview exclusion and three-site integration.');
for (const target of ['main', 'academy']) {
  const adsTxt = fs
    .readFileSync(`dist/${target}/ads.txt`, 'utf8')
    .replace(/\r\n/g, '\n');

  assert.equal(
    adsTxt,
    'google.com, pub-1656597464906448, DIRECT, f08c47fec0942fa0\n'
  );
}
assert(!fs.existsSync('dist/services/ads.txt'));
console.log('PASS: publisher ads.txt on main and Academy only.');

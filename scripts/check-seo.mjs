import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const origins={main:'https://cyberdefend.in',services:'https://services.cyberdefend.in',academy:'https://academy.cyberdefend.in'};
const hostToSite=Object.fromEntries(Object.entries(origins).map(([k,v])=>[new URL(v).hostname,k]));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const rules=JSON.parse(fs.readFileSync('src/data/redirects.json','utf8'));
function exists(url){const site=hostToSite[url.hostname];if(!site)return false;const f=path.join('dist',site,url.pathname);return fs.existsSync(path.extname(f)?f:path.join(f,'index.html'));}
function resolve(raw){let u=new URL(raw);const seen=new Set();let steps=0;while(!exists(u)){
 assert(!seen.has(u.href),`Redirect cycle: ${u}`);seen.add(u.href);assert(steps++<5,'Too many redirects');const site=hostToSite[u.hostname];let found=false;
 for(const [from,to] of rules[site]||[]){let splat='';let match=false;
  if(from.endsWith('*')){const prefix=from.slice(0,-1);match=u.pathname.startsWith(prefix);if(match)splat=u.pathname.slice(prefix.length);}
  else match=u.pathname.replace(/\/$/,'')===from;
  if(match){const old=u;u=new URL(to.replace(':splat',splat),old.origin);if(!u.search)u.search=old.search;found=true;break;}
 }
 assert(found,`Unmapped route: ${u}`);
}return {url:u,steps};}
let count=0;
for(const [site,list] of Object.entries(rules)){
 const file=fs.readFileSync(`dist/${site}/_redirects`,'utf8');
 for(const [from,to] of list){assert(file.includes(`${from} ${to} 301`));if(from.includes('*'))continue;
  for(const suffix of ['','/']){const r=resolve(origins[site]+from+suffix);assert(r.steps<=2);count++;}
 }
}
for(const site of ['services','academy'])assert.equal(resolve(origins[site]+'/careers/example-role').url.pathname,'/careers/');
assert.equal(resolve(origins.academy+'/contact?topic=Professional%20training').url.searchParams.get('topic'),'Professional training');
assert.equal(resolve(origins.academy+'/certification/cissp').url.searchParams.get('certification'),'cissp');
assert(exists(new URL(origins.academy+'/blogs/ransomware/')));
assert(exists(new URL(origins.academy+'/courses/cybersecurity-beginners/')));
assert.equal(resolve(origins.main+'/academy/labs/').url.href,origins.academy+'/labs/');
const careersMap=fs.readFileSync('dist/main/sitemap.xml','utf8');assert.equal([...careersMap.matchAll(/<loc>https:\/\/cyberdefend\.in\/careers\//g)].length,7,'Careers hub and six open roles must be indexed');
assert.equal(resolve(origins.main+'/careers/ui-ux-design-intern').url.pathname,'/careers/');
let pages=0,sitemapUrls=0;
for(const [site,origin] of Object.entries(origins)){
 const titles=new Set();const sitemap=fs.readFileSync(`dist/${site}/sitemap.xml`,'utf8');
 for(const [,url] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)){const u=new URL(url);assert.equal(u.origin,origin);assert(exists(u));assert(!/\/casestudies\//.test(u.pathname));if(site!=='main')assert(!u.pathname.startsWith('/careers/'));sitemapUrls++;}
 for(const file of walk(`dist/${site}`).filter(f=>f.endsWith('index.html'))){const html=fs.readFileSync(file,'utf8');pages++;
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)[1];assert(canonical.startsWith(origin+'/'));assert(exists(new URL(canonical)));
  const title=html.match(/<title>(.*?)<\/title>/)[1];assert(!titles.has(title),`Duplicate title: ${title}`);titles.add(title);
  assert(html.match(/name="description" content="[^"]+"/));
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert(schema['@graph'].some(n=>n['@type']==='WebSite'));
  assert(schema['@graph'].some(n=>n['@id']===canonical+'#webpage'));
  for(const node of schema['@graph'].filter(n=>n['@type']==='BreadcrumbList'))assert(node.itemListElement.length>=2);
 }
}
console.log(`PASS: ${count} legacy redirect cases, query preservation, wildcard destinations; ${pages} SEO pages; ${sitemapUrls} sitemap URLs.`);

import fs from 'node:fs';
import assert from 'node:assert/strict';

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const validDate=value=>datePattern.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export const publicationDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const displayDate=value=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
export function validatePosts(posts,legacySlugs=[],today=publicationDay()) {
 assert(Array.isArray(posts),'Current posts must be an array');
 const slugs=new Set(legacySlugs),dates=new Set();
 for(const post of posts){
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug),'Use a stable lowercase article slug');
  assert(!slugs.has(post.slug),'Duplicate article slug: '+post.slug);slugs.add(post.slug);
  for(const key of ['title','description','summary','category'])assert(typeof post[key]==='string'&&post[key].trim(),`Missing article ${key}`);
  assert(post.author==='CyberDefend','Use truthful CyberDefend organisation authorship');
  assert(validDate(post.datePublished)&&validDate(post.dateModified),'Invalid article date');
  assert(post.datePublished<=post.dateModified&&post.dateModified<=today,'Article dates must be chronological and not in the future');
  assert(!dates.has(post.datePublished),'Only one new article per Asia/Kolkata date');dates.add(post.datePublished);
  assert(Array.isArray(post.sources)&&post.sources.length>=2,'Include at least two substantive sources');
  const sourceIds=new Set();
  for(const source of post.sources){
   assert(typeof source.id==='string'&&source.id&&!sourceIds.has(source.id),'Duplicate or missing source ID');sourceIds.add(source.id);
   assert(typeof source.title==='string'&&source.title.trim(),'Missing source title');
   const url=new URL(source.url);assert(url.protocol==='https:'&&!url.username&&!url.password,'Sources must use public HTTPS URLs');
  }
  const inline=parts=>{assert(Array.isArray(parts)&&parts.length,'Missing inline content');for(const part of parts){assert(typeof part.text==='string','Inline text is required');assert(!(part.source&&part.internal),'Choose one link type');if(part.source)assert(sourceIds.has(part.source),'Unknown source reference');if(part.internal)assert(typeof part.internal==='string','Invalid internal link');}};
  const ids=new Set(['article-sources']);
  assert(Array.isArray(post.blocks)&&post.blocks.length,'Article needs content');
  for(const block of post.blocks){
   switch(block.type){
    case 'heading':assert(typeof block.text==='string'&&block.text.trim(),'Heading text required');assert(/^[a-z][a-z0-9-]*$/.test(block.id)&&!ids.has(block.id),'Duplicate or invalid heading ID');ids.add(block.id);break;
    case 'paragraph':inline(block.content);break;
    case 'list':assert(Array.isArray(block.items)&&block.items.length,'List items required');block.items.forEach(inline);break;
    case 'table':assert(typeof block.caption==='string'&&block.caption,'Table caption required');assert(Array.isArray(block.headers)&&block.headers.length&&block.headers.every(x=>typeof x==='string'),'Table headers required');assert(Array.isArray(block.rows)&&block.rows.length,'Table rows required');for(const row of block.rows)assert(row.length===block.headers.length&&row.every(x=>typeof x==='string'),'Invalid table row');break;
    default:throw new Error('Unsupported article block: '+block.type);
   }
  }
 }
 return posts;
}
export function postWordCount(post){
 const text=post.blocks.flatMap(b=>b.type==='heading'?[b.text]:b.type==='paragraph'?b.content.map(p=>p.text):b.type==='list'?b.items.flat().map(p=>p.text):[b.caption,...b.headers,...b.rows.flat()]).join(' ');
 return text.trim().split(/\s+/).length;
}
export function addCurrentPosts({defs,pages,link,pageHero,section,head,textLink,esc}){
 const archive=JSON.parse(fs.readFileSync('src/data/legacy-articles.json','utf8'));
 const posts=validatePosts(JSON.parse(fs.readFileSync('src/data/current-posts.json','utf8')),archive.map(a=>a.slug)).sort((a,b)=>b.datePublished.localeCompare(a.datePublished));
 for(const p of posts)defs['post_'+p.slug]=['academy','blogs/'+p.slug+'/'];
 for(const p of posts){
  const sources=Object.fromEntries(p.sources.map(s=>[s.id,s]));
  const inline=parts=>parts.map(part=>{
   if(part.source)return `<a href="${esc(sources[part.source].url)}">${esc(part.text)}</a>`;
   if(part.internal){assert(defs[part.internal],'Unknown internal article link: '+part.internal);return `<a href="${esc(link(part.internal))}">${esc(part.text)}</a>`;}
   return esc(part.text);
  }).join('');
  const blocks=p.blocks.map(b=>{
   if(b.type==='heading')return `<h2 id="${esc(b.id)}">${esc(b.text)}</h2>`;
   if(b.type==='paragraph')return `<p>${inline(b.content)}</p>`;
   if(b.type==='list')return `<ul>${b.items.map(item=>`<li>${inline(item)}</li>`).join('')}</ul>`;
   return `<div class="blog-table" role="region" aria-label="${esc(b.caption)}" tabindex="0"><table><caption>${esc(b.caption)}</caption><thead><tr>${b.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map((cell,i)=>i===0?`<th scope="row">${esc(cell)}</th>`:`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('');
  const minutes=Math.max(1,Math.ceil(postWordCount(p)/220));
  pages['post_'+p.slug]={title:p.title,description:p.description,article:p,styles:['blog.css'],body:`<article class="blog-article"><header class="container blog-header"><div class="breadcrumbs"><a href="${link('academy')}">Academy</a> / <a href="${link('resources')}">Insights</a></div><div class="eyebrow">${esc(p.category)}</div><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p><p class="blog-byline">By ${esc(p.author)} · Published <time datetime="${p.datePublished}">${displayDate(p.datePublished)}</time>${p.dateModified!==p.datePublished?` · Updated <time datetime="${p.dateModified}">${displayDate(p.dateModified)}</time>`:''} · ${minutes} min read</p></header>${section(`<div class="long-copy blog-copy"><nav class="blog-contents" aria-label="Article contents"><strong>In this article</strong><ul>${p.blocks.filter(b=>b.type==='heading').map(b=>`<li><a href="#${b.id}">${esc(b.text)}</a></li>`).join('')}</ul></nav>${blocks}<section class="blog-sources" aria-labelledby="article-sources"><h2 id="article-sources">Sources & further reading</h2><ol>${p.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a></li>`).join('')}</ol></section>${textLink('Back to all insights','resources')}</div>`)}</article>`};
 }
 pages.resources={title:'Cybersecurity Insights & Practical Security Guides',description:'Read current cybersecurity analysis, vulnerability response guides and practical defensive advice from CyberDefend, alongside our educational article archive.',styles:['blog.css'],body:pageHero('Academy / Insights','Cybersecurity insights.<br><em>Put knowledge to work.</em>','Current security developments, practical defensive guidance and clear explanations for people building their skills.')+section(`${head('Current analysis','Latest insights','Original articles with primary sources and practical next steps.')}<div class="grid3" data-blog-list="latest">${posts.map(p=>`<article class="tile"><div class="meta">${esc(p.category)} · <time datetime="${p.datePublished}">${displayDate(p.datePublished)}</time></div><h3><a href="${link('post_'+p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p><a class="text-link" href="${link('post_'+p.slug)}">Read article <span aria-hidden="true">↗</span></a></article>`).join('')}</div>`)+section(`${head('Earlier educational material','Article archive','Preserved articles from our previous website. Product references and configuration examples may be dated.')}<div class="grid3" data-blog-list="archive">${archive.map(a=>`<article class="tile"><div class="meta">Article archive</div><h3>${esc(a.title)}</h3><p>Educational reading from the original CyberDefend website.</p><a class="text-link" href="${link('article_'+a.slug)}">Read archived article <span aria-hidden="true">↗</span></a></article>`).join('')}</div>`,'soft')};
}

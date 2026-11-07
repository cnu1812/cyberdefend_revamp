const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#navigation');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);toggle.textContent=open?'Close':'Menu';});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){toggle.click();toggle.focus();}});nav.addEventListener('click',e=>{if(e.target.closest('a')&&toggle.getAttribute('aria-expanded')==='true')toggle.click();});}
const filters=document.querySelectorAll('[data-filter]');
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let count=0;document.querySelectorAll('[data-category]').forEach(card=>{const show=button.dataset.filter==='all'||card.dataset.category===button.dataset.filter;card.hidden=!show;if(show)count++;});document.querySelector('#filter-count').textContent=`${count} learning ${count===1?'area':'areas'}`;}));
const form=document.querySelector('#enquiry-form');
if(form){
 const wanted=new URLSearchParams(location.search).get('topic');
 const select=form.elements.topic;
 if(wanted&&[...select.options].some(o=>o.value===wanted))select.value=wanted;
 let pending=false,requestId='',lastPayload='';
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(pending||!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  const payload=JSON.stringify(data);
  if(payload!==lastPayload){requestId=crypto.randomUUID();lastPayload=payload;}
  const status=document.querySelector('#form-status'),button=form.querySelector('[type="submit"]');
  pending=true;button.disabled=true;button.textContent='Sending…';form.setAttribute('aria-busy','true');status.textContent='Sending your enquiry…';status.dataset.state='pending';
  try{
   const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestId}),signal:AbortSignal.timeout(25000)});
   let result;try{result=await response.json();}catch{throw new Error(response.status===429?'Please wait a minute before trying again.':'We couldn’t confirm receipt. Please try again or email support@cyberdefend.in.');}
   if(!response.ok||result.ok!==true||result.requestId!==requestId)throw new Error(result.message||'We couldn’t confirm receipt. Please try again.');
   status.textContent=result.message;status.dataset.state='success';form.reset();requestId='';lastPayload='';
   document.dispatchEvent(new Event('cyberdefend:enquiry-success'));
   if(typeof gtag ==='function')gtag('event','generate_lead',{'value':1});
  }catch(error){status.textContent=error.name==='TimeoutError'?'We couldn’t confirm receipt in time. Please try again; we’ll avoid saving a duplicate enquiry.':error.message;status.dataset.state='error';}
  finally{pending=false;button.disabled=false;button.innerHTML='Send enquiry <span aria-hidden="true">↗</span>';form.removeAttribute('aria-busy');status.focus();}
 });
}
// Preserve the intent of legacy certification/course enquiry links.
{
 const params=new URLSearchParams(location.search);
 const certification=params.get('certification');
 const programme=params.get('programme');
 const composer=document.querySelector('#enquiry-form');
 if(composer&&(certification||programme)){
  const value=(certification||programme).replace(/-/g,' ').slice(0,150);
  composer.elements.topic.value=certification?'Certification offer':'Professional training';
  if(!composer.elements.message.value)composer.elements.message.value=`I would like the current details for ${value}.`;
 }
 if(!composer&&certification){
  document.querySelectorAll('a[href*="topic=Certification"]').forEach(a=>{
   const u=new URL(a.getAttribute('href'),location.href);u.searchParams.set('certification',certification.slice(0,150));a.href=u.href;
  });
 }
}

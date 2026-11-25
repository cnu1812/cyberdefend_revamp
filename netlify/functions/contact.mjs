const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const config={rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};

export async function submitEnquiry(request,{env,send=fetch}={}){
  if(request.method!=='POST')return reply(405,{ok:false,message:'Please submit the contact form.'});
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply(403,{ok:false,message:'Please submit from this website.'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{ok:false,message:'Unsupported submission format.'});
  const text=await request.text();
  if(text.length>12000)return reply(413,{ok:false,message:'Please shorten your message.'});
  let input;try{input=JSON.parse(text);}catch{return reply(400,{ok:false,message:'Please check your details.'});}
  if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{ok:false,message:'Please check your details.'});
  const data={};
  for(const [key,max] of Object.entries({name:100,email:200,phone:30,organisation:150,topic:100,message:2500,requestId:80,website:200,userAgent:1000})){
    if(input[key]!=null&&typeof input[key]!=='string')return reply(400,{ok:false,message:'Please check your details.'});
    data[key]=(input[key]||'').trim();
    if(data[key].length>max)return reply(400,{ok:false,message:'Please shorten the highlighted details.'});
  }
  if(data.website||!data.name||!data.topic||!data.message||!/^\S+@\S+\.\S+$/.test(data.email)||!/^[-\w]{16,80}$/.test(data.requestId))return reply(400,{ok:false,message:'Please check your name, email and message.'});
  const endpoint=env('CONTACT_APPS_SCRIPT_URL'),secret=env('CONTACT_SHARED_SECRET');
  if(!endpoint||!secret)return reply(503,{ok:false,message:'Online enquiries are temporarily unavailable. Please email support@cyberdefend.in.'});
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(endpoint))return reply(503,{ok:false,message:'Online enquiries are temporarily unavailable. Please email support@cyberdefend.in.'});
  try{
    const response=await send(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,secret}),redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Upstream unavailable');
    const result=await response.json();
    if(result.ok!==true||result.requestId!==data.requestId)throw new Error('Unconfirmed save');
    return reply(200,{ok:true,requestId:result.requestId,message:'Thank you — your enquiry has been received. Our team will contact you using the details you provided.'});
  }catch{
    return reply(502,{ok:false,message:'We couldn’t confirm receipt. Please try again; retrying will not create a duplicate enquiry. You can also email support@cyberdefend.in.'});
  }
}
export default request=>submitEnquiry(request,{env:key=>Netlify.env.get(key)});

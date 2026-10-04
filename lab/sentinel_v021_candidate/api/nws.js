import { executeTransport, TransportError } from '../lib/nws-transport.js';

function send(res,status,body,headers={}){ for(const [k,v] of Object.entries(headers)) res.setHeader(k,v); res.status(status).json(body); }
export default async function handler(req,res){
  if(req.method!=='GET') { res.setHeader('Allow','GET'); return send(res,405,{ok:false,error:'method_not_allowed'}); }
  if((req.headers['content-length'] && req.headers['content-length']!=='0') || req.headers['transfer-encoding']) return send(res,400,{ok:false,error:'body_not_allowed'});
  const origin=req.headers.origin; if(origin){ let o; try{o=new URL(origin)}catch{return send(res,403,{ok:false,error:'cross_site_rejected'})} const host=req.headers.host; if(o.host!==host) return send(res,403,{ok:false,error:'cross_site_rejected'}); }
  const site=req.headers['sec-fetch-site']; if(site && !['same-origin','none'].includes(site)) return send(res,403,{ok:false,error:'cross_site_rejected'});
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000);
  try { const envelope=await executeTransport(req.url,{signal:controller.signal}); return send(res,envelope.ok?200:502,envelope,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'}); }
  catch(e){ if(e?.name==='AbortError') return send(res,504,{ok:false,error:'timeout'}); if(e instanceof TransportError) return send(res,e.status,{ok:false,error:e.code}); return send(res,502,{ok:false,error:'upstream_unavailable'}); }
  finally { clearTimeout(timer); }
}

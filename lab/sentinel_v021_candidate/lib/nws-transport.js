import { createHash, randomUUID } from 'node:crypto';

export const TRANSPORT_VERSION = 'sentinel-nws-transport/0.2-prep';
export const APPLICATION_ID = 'FreeFrequencySentinel/0.2';
export const NWS_ORIGIN = 'https://api.weather.gov';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_ALERT_ID = 512;
const LAND_AREAS = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','AS','GU','MP','PR','VI']);
const ZONE_RE = /^[A-Z]{2}[CZ][0-9]{3}$/;
const OFFICE_RE=/^[A-Z]{3}$/;
const GRID_RE=/^[0-9]{1,4}$/;
const COORD_RE=/^-?[0-9]{1,3}(?:\.[0-9]{1,6})?$/;

export class TransportError extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}
const bad=(status,code,msg)=>{ throw new TransportError(status,code,msg); };
function one(sp,key,{required=true}={}) {
  const all=sp.getAll(key); if (all.length>1) bad(400,'duplicate_parameter',`duplicate ${key}`);
  if(required && all.length!==1) bad(400,'missing_parameter',`missing ${key}`);
  return all[0] ?? null;
}
function exactKeys(sp, allowed) { for (const k of sp.keys()) if(!allowed.has(k)) bad(400,'unknown_parameter',`unknown ${k}`); }
function area(v){ if(!LAND_AREAS.has(v)) bad(400,'invalid_area','unsupported land area'); return v; }
function zone(v,type){ if(!ZONE_RE.test(v)) bad(400,'invalid_zone','invalid zone id'); if(v.slice(0,2)!=='MI') bad(400,'invalid_zone','V0.2 prep is MI only'); if(type==='county'&&v[2]!=='C') bad(400,'invalid_zone','county zone required'); if(type==='forecast'&&v[2]!=='Z') bad(400,'invalid_zone','forecast zone required'); return v; }
function coord(v,min,max,key){ if(!COORD_RE.test(v||'')) bad(400,'invalid_'+key,'invalid '+key); const n=Number(v); if(!Number.isFinite(n)||n<min||n>max) bad(400,'invalid_'+key,'invalid '+key); return String(n); }
function office(v){ if(!OFFICE_RE.test(v||'')) bad(400,'invalid_office','invalid forecast office'); return v; }
function grid(v,key){ if(!GRID_RE.test(v||'')) bad(400,'invalid_'+key,'invalid '+key); const n=Number(v); if(!Number.isSafeInteger(n)||n<0||n>9999) bad(400,'invalid_'+key,'invalid '+key); return String(n); }
function alertId(v){
  if(!v || v.length>MAX_ALERT_ID) bad(400,'invalid_alert_id','invalid alert id');
  let d; try { d=decodeURIComponent(v); } catch { bad(400,'invalid_alert_id','bad encoding'); }
  if(d.length>MAX_ALERT_ID || /[\\/\x00-\x1F\x7F%]/.test(d) || /:\/\/|@|[?#]/.test(d)) bad(400,'invalid_alert_id','unsafe alert id');
  return encodeURIComponent(d);
}
export function buildUpstreamUrl(inputUrl) {
  const u=new URL(inputUrl,'http://sentinel.local');
  if(u.origin!=='http://sentinel.local' || u.pathname!=='/api/nws') bad(400,'invalid_route','invalid route');
  const op=one(u.searchParams,'op');
  let out;
  if(op==='zones') { exactKeys(u.searchParams,new Set(['op','area','type'])); const a=area(one(u.searchParams,'area')); const t=one(u.searchParams,'type'); if(!['county','forecast'].includes(t)) bad(400,'invalid_type','invalid zone type'); out=new URL('/zones',NWS_ORIGIN); out.search=new URLSearchParams({area:a,type:t}).toString(); }
  else if(op==='zone') { exactKeys(u.searchParams,new Set(['op','type','id'])); const t=one(u.searchParams,'type'); if(!['county','forecast'].includes(t)) bad(400,'invalid_type','invalid zone type'); const id=zone(one(u.searchParams,'id'),t); out=new URL(`/zones/${t}/${id}`,NWS_ORIGIN); }
  else if(op==='point') { exactKeys(u.searchParams,new Set(['op','lat','lon'])); const lat=coord(one(u.searchParams,'lat'),-90,90,'lat'); const lon=coord(one(u.searchParams,'lon'),-180,180,'lon'); out=new URL(`/points/${lat},${lon}`,NWS_ORIGIN); }
  else if(op==='forecast') { exactKeys(u.searchParams,new Set(['op','office','x','y'])); const o=office(one(u.searchParams,'office')); const x=grid(one(u.searchParams,'x'),'grid_x'); const y=grid(one(u.searchParams,'y'),'grid_y'); out=new URL(`/gridpoints/${o}/${x},${y}/forecast`,NWS_ORIGIN); }
  else if(op==='alerts') { exactKeys(u.searchParams,new Set(['op','zone'])); const id=zone(one(u.searchParams,'zone'),'county'); out=new URL('/alerts/active',NWS_ORIGIN); out.search=new URLSearchParams({zone:id,status:'actual'}).toString(); }
  else if(op==='alert') { exactKeys(u.searchParams,new Set(['op','id'])); out=new URL(`/alerts/${alertId(one(u.searchParams,'id'))}`,NWS_ORIGIN); }
  else bad(400,'invalid_operation','unsupported operation');
  if(out.protocol!=='https:'||out.hostname!=='api.weather.gov'||out.port) bad(500,'egress_invariant','egress invariant failed');
  return out;
}
export function makeUpstreamRequest(url,{etag,lastModified}={}) {
  const headers=new Headers({'Accept':'application/geo+json','User-Agent':APPLICATION_ID});
  if(etag) headers.set('If-None-Match',etag); if(lastModified) headers.set('If-Modified-Since',lastModified);
  return new Request(url,{method:'GET',headers,redirect:'manual'});
}
async function readBounded(res){ const ab=await res.arrayBuffer(); if(ab.byteLength>MAX_BODY_BYTES) bad(502,'body_too_large','upstream body exceeds 2 MiB'); return new Uint8Array(ab); }
const h=(res,k)=>res.headers.get(k);
export async function executeTransport(inputUrl,{fetchImpl=fetch,signal,etag,lastModified,cachedBody}={}) {
  const upstream=buildUpstreamUrl(inputUrl); const req=makeUpstreamRequest(upstream,{etag,lastModified}); const started=new Date().toISOString();
  const res=await fetchImpl(req,{signal,redirect:'manual'});
  if([301,302,303,307,308].includes(res.status)) bad(502,'redirect_rejected','upstream redirect rejected');
  if(res.status===304) {
    if(!cachedBody) bad(503,'orphan_304','304 without matching cached body');
    const raw=Buffer.from(cachedBody); const received=new Date().toISOString();
    return {ok:true,transportVersion:TRANSPORT_VERSION,configuredApplicationId:APPLICATION_ID,correlationId:randomUUID(),upstream:{url:upstream.href,status:304,requestStarted:started,responseReceived:received,headers:{date:h(res,'date'),age:h(res,'age'),etag:h(res,'etag'),lastModified:h(res,'last-modified'),cacheControl:h(res,'cache-control'),retryAfter:h(res,'retry-after'),requestId:h(res,'x-request-id')}},cache:{revalidated:true},representation:{encoding:'base64',bytes:raw.toString('base64'),sha256:createHash('sha256').update(raw).digest('hex')}};
  }
  const bytes=await readBounded(res); const received=new Date().toISOString(); const raw=Buffer.from(bytes);
  return {ok:res.ok,transportVersion:TRANSPORT_VERSION,configuredApplicationId:APPLICATION_ID,correlationId:randomUUID(),upstream:{url:upstream.href,status:res.status,requestStarted:started,responseReceived:received,headers:{date:h(res,'date'),age:h(res,'age'),etag:h(res,'etag'),lastModified:h(res,'last-modified'),cacheControl:h(res,'cache-control'),retryAfter:h(res,'retry-after'),requestId:h(res,'x-request-id')}},representation:{encoding:'base64',bytes:raw.toString('base64'),sha256:createHash('sha256').update(raw).digest('hex')}};
}

// Isolated Col relay candidate: Cloudflare Worker + Durable Object.
// NOT deployed. Owner secret must be set with wrangler secret, never in source.
import {DurableCommandCore} from '../relay-prototype/durable-core.mjs';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const token=()=>{const a=new Uint8Array(32);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');};
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const constant=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const bearer=req=>/^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization')||'')?.[1]||'';
const code6=()=>{const a=new Uint32Array(1);let n;do{crypto.getRandomValues(a);n=a[0]}while(n>=4294000000);return String(n%1000000).padStart(6,'0');};
export class ColReceiver {
  constructor(state,env){this.storage=state.storage;this.core=new DurableCommandCore(this.storage);this.env=env;}
  async fetch(req){
    const url=new URL(req.url),path=url.pathname;
    const method={ '/api/provision':'POST','/api/pair/start':'POST','/api/pair/confirm':'POST','/api/pair/complete':'POST','/api/animal/select':'POST','/api/receiver/next':'GET','/api/pair/revoke':'POST'}[path];
    if(!method)return json(404,{error:'not_found'});
    if(req.method!==method)return json(405,{error:'method_not_allowed'});
    let body={};
    if(method==='POST'){
      if(Number(req.headers.get('content-length')||0)>2048)return json(413,{error:'body_too_large'});
      const raw=await req.text();
      if(raw.length>2048)return json(413,{error:'body_too_large'});
      try{body=JSON.parse(raw||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json(400,{error:'invalid_body'});}
    }
    if(path==='/api/provision'){
      if(!this.env.OWNER_PROVISION_SECRET||!constant(req.headers.get('x-owner-secret'),this.env.OWNER_PROVISION_SECRET))return json(403,{error:'owner_required'});
      return this.storage.transaction(async tx=>{
        if(await tx.get('receiverHash'))return json(409,{error:'already_provisioned'});
        const receiverToken=token();
        await tx.put('receiverHash',await hash(receiverToken));
        await tx.put('revoked',false);
        return json(201,{receiverToken});
      });
    }
    const revoked=await this.storage.get('revoked');
    if(revoked)return json(403,{error:'receiver_revoked'});
    const auth=bearer(req);
    const role=(path==='/api/animal/select')?'sender':'receiver';
    if(path!=='/api/pair/complete'){
      const expected=await this.storage.get(role+'Hash');
      if(!auth||!expected||!constant(await hash(auth),expected))return json(401,{error:'unauthorized'});
    }
    if(path==='/api/pair/start'){
      return this.storage.transaction(async tx=>{
        // A receiver may create at most one pairing window per two minutes.
        const now=Date.now(),cooldown=await tx.get('pairingCooldownUntil')||0;
        if(now<cooldown)return json(429,{error:'pairing_cooldown'});
        const code=code6();
        await tx.put('pairingHash',await hash(code));
        await tx.put('pairingExpiry',now+120000);
        await tx.put('pairingCooldownUntil',now+120000);
        await tx.put('pairingAttempts',0);
        await tx.put('pairingConfirmed',false);
        return json(200,{code,expiresInSeconds:120});
      });
    }
    if(path==='/api/pair/confirm'){
      if(!(await this.storage.get('pairingHash'))||Date.now()>=(await this.storage.get('pairingExpiry')||0))return json(410,{error:'pairing_expired'});
      await this.storage.put('pairingConfirmed',true);
      return json(200,{confirmed:true});
    }
    if(path==='/api/pair/complete'){
      if(typeof body.code!=='string'||!/^[0-9]{6}$/.test(body.code))return json(400,{error:'invalid_code'});
      return this.storage.transaction(async tx=>{
        const now=Date.now(),expiry=await tx.get('pairingExpiry')||0,stored=await tx.get('pairingHash');
        if(!stored||now>=expiry)return json(404,{error:'invalid_or_expired_code'});
        const attempts=await tx.get('pairingAttempts')||0;
        if(attempts>=5)return json(429,{error:'pairing_attempts_exhausted'});
        if(!constant(stored,await hash(body.code))){await tx.put('pairingAttempts',attempts+1);return json(404,{error:'invalid_or_expired_code'});}
        if(!(await tx.get('pairingConfirmed')))return json(409,{error:'tv_confirmation_required'});
        const senderToken=token();
        await tx.put('senderHash',await hash(senderToken));
        await tx.delete('pairingHash');await tx.delete('pairingExpiry');await tx.delete('pairingConfirmed');
        return json(200,{senderToken});
      });
    }
    if(path==='/api/animal/select'){
      const result=await this.core.select({letter:body.letter,clientEventId:body.clientEventId});
      return json(result.status,result);
    }
    if(path==='/api/receiver/next'){
      const cursor=url.searchParams.get('after')||'0';
      if(!/^(0|[1-9][0-9]{0,14})$/.test(cursor))return json(400,{error:'invalid_cursor'});
      const result=await this.core.poll(Number(cursor));
      return json(result.status,result);
    }
    if(path==='/api/pair/revoke'){
      const result=await this.core.revoke();
      return json(result.status,result);
    }
    return json(404,{error:'not_found'});
  }
}
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    if(url.protocol!=='https:')return json(400,{error:'https_required'});
    // Browser clients are permitted only from the exact configured Fire PWA origin.
    // Roku requests have no Origin and use receiver credentials.
    const origin=req.headers.get('origin');
    if(origin){
      if(!env.TABLET_ALLOWED_ORIGIN||origin!==env.TABLET_ALLOWED_ORIGIN)return json(403,{error:'origin_not_allowed'});
      if(req.method==='OPTIONS'){
        const requested=req.headers.get('access-control-request-headers')||'';
        if(!/^[a-zA-Z0-9, -]*$/.test(requested))return json(400,{error:'invalid_preflight'});
        return new Response(null,{status:204,headers:{
          'access-control-allow-origin':origin,
          'access-control-allow-methods':'POST, GET, OPTIONS',
          'access-control-allow-headers':'authorization, content-type',
          'access-control-max-age':'300','vary':'Origin'
        }});
      }
      const response=await routeReceiver(req,env,url);
      const headers=new Headers(response.headers);
      headers.set('access-control-allow-origin',origin);
      headers.set('vary','Origin');
      return new Response(response.body,{status:response.status,headers});
    }
    if(req.method==='OPTIONS')return json(405,{error:'method_not_allowed'});
    return routeReceiver(req,env,url);
  }
};
async function routeReceiver(req,env,url){
    const id=url.searchParams.get('receiverId');
    if(!id||!/^[a-zA-Z0-9_-]{12,64}$/.test(id))return json(400,{error:'receiver_id_required'});
    // The receiver ID is opaque routing, not an authentication credential.
    const object=env.COL_RECEIVERS.get(env.COL_RECEIVERS.idFromName(id));
    return object.fetch(req);
}

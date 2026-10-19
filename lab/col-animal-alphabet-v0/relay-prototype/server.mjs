import {createServer} from 'node:http';
import {randomBytes, randomInt, createHash, timingSafeEqual} from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const secureEqual = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x,y);
};
export function createRelay({now=()=>Date.now(), origin='http://localhost:8788', pairingTtlMs=120000, bootstrapSecret=null}={}) {
  const sessions=new Map();
  const requests=new Map();
  function cleanup() {
    for(const [id,s] of sessions) if(s.expiresAt < now() || s.revoked) sessions.delete(id);
    for(const [key,r] of requests) if(r.until < now()) requests.delete(key);
  }
  function limit(key, max=20, windowMs=60000) {
    const t=now();const r=requests.get(key);
    if(!r || r.until < t){requests.set(key,{count:1,until:t+windowMs});return true;}
    r.count++;return r.count<=max;
  }
  const send=(res,status,body)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':origin,'vary':'Origin'});
    res.end(JSON.stringify(body));
  };
  async function handle(req,res) {
    cleanup();
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET' && url.pathname==='/health') return send(res,200,{ok:true,mode:'volatile-prototype'});
    const remote=req.socket.remoteAddress||'unknown';
    // This proof must never become an accidental public service.
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))return send(res,403,{error:'local_only'});
    if(!limit('ip:'+remote,120)) return send(res,429,{error:'rate_limited'});
    if(req.method==='OPTIONS') {
      res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization','vary':'Origin'});return res.end();
    }
    if(req.headers.origin && req.headers.origin!==origin) return send(res,403,{error:'origin_denied'});
    let body={};
    if(req.method==='POST'){
      try{
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('too_large');}
        body=JSON.parse(raw||'{}');
      }catch{return send(res,400,{error:'invalid_body'});}
    }
    const bearer=(req.headers.authorization||'').match(/^Bearer ([-_a-zA-Z0-9]+)$/)?.[1];
    const auth=(s,key)=>bearer && secureEqual(hash(bearer),s[key]);
    if(req.method==='POST' && url.pathname==='/api/pair/start'){
      // Local proof only. A real service must authenticate receiver bootstrap
      // before issuing its device credential; never expose this endpoint publicly.
      if(!limit('start:'+remote,5,60000))return send(res,429,{error:'rate_limited'});
      // Optional local development bootstrap gate. A real public deployment also
      // requires durable provisioning, authorization, storage and device ownership.
      if(bootstrapSecret && !secureEqual(bearer,bootstrapSecret))return send(res,401,{error:'bootstrap_unauthorized'});
      const id=token(),receiverToken=token();
      let code;
      do{code=String(randomInt(0,1000000)).padStart(6,'0');}while([...sessions.values()].some(s=>s.code===code));
      sessions.set(id,{code,receiverHash:hash(receiverToken),senderHash:null,expiresAt:now()+pairingTtlMs,commandId:0,command:null,paired:false,revoked:false});
      return send(res,201,{receiverId:id,receiverToken,code,expiresInSeconds:Math.ceil(pairingTtlMs/1000)});
    }
    if(req.method==='POST' && url.pathname==='/api/pair/complete'){
      if(!limit('complete:'+remote,10,60000))return send(res,429,{error:'rate_limited'});
      const s=[...sessions.entries()].find(([,v])=>typeof body.code==='string' && secureEqual(v.code,body.code) && !v.paired && v.expiresAt>now());
      if(!s)return send(res,404,{error:'invalid_or_expired_code'});
      const [id,session]=s;const senderToken=token();
      session.senderHash=hash(senderToken);session.code=null;session.paired=true;session.expiresAt=now()+24*60*60*1000;
      return send(res,200,{receiverId:id,senderToken});
    }
    const id=typeof body.receiverId==='string'?body.receiverId:url.searchParams.get('receiverId');
    const s=sessions.get(id);
    if(!s)return send(res,404,{error:'not_found'});
    if(req.method==='POST' && url.pathname==='/api/animal/select'){
      if(!s.paired||!auth(s,'senderHash'))return send(res,401,{error:'unauthorized'});
      if(typeof body.letter!=='string'||!/^[A-Z]$/.test(body.letter))return send(res,400,{error:'invalid_animal'});
      s.commandId++;
      s.command={commandId:s.commandId,letter:body.letter};
      return send(res,200,{commandId:s.commandId,letter:body.letter});
    }
    if(req.method==='GET' && url.pathname==='/api/receiver/next'){
      if(!auth(s,'receiverHash'))return send(res,401,{error:'unauthorized'});
      const after=Number(url.searchParams.get('after')||0);
      if(!Number.isSafeInteger(after)||after<0)return send(res,400,{error:'invalid_cursor'});
      if(!s.command||s.command.commandId<=after)return send(res,200,{command:null,paired:s.paired});
      return send(res,200,{command:s.command,paired:s.paired});
    }
    if(req.method==='POST' && url.pathname==='/api/pair/revoke'){
      if(!auth(s,'senderHash')&&!auth(s,'receiverHash'))return send(res,401,{error:'unauthorized'});
      s.revoked=true;return send(res,200,{revoked:true});
    }
    return send(res,404,{error:'not_found'});
  }
  return {handle};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const relay=createRelay({origin:process.env.ALLOWED_ORIGIN||'http://localhost:8788',bootstrapSecret:process.env.RELAY_BOOTSTRAP_SECRET||null});
  createServer((req,res)=>relay.handle(req,res).catch(()=>{res.writeHead(500);res.end();})).listen(Number(process.env.PORT||8788),'127.0.0.1',()=>console.log('Local-only volatile relay listening'));
}

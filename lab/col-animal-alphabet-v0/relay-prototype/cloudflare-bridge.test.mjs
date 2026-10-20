import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{ColReceiver} from '../cloudflare-bridge/worker.mjs';
class Storage {
  constructor(){this.m=new Map();}
  async get(k){return this.m.get(k);}
  async put(k,v){this.m.set(k,structuredClone(v));}
  async delete(k){this.m.delete(k);}
  async transaction(fn){return fn(this);}
}
test('isolated Worker routes real Request objects through DO, pairing and B→B',async()=>{
  const storage=new Storage(),instance=new ColReceiver({storage},{OWNER_PROVISION_SECRET:'test-owner-secret'});
  const env={COL_RECEIVERS:{idFromName:x=>x,get:()=>instance}};
  const url=p=>'https://example.workers.dev'+p+(p.includes('?')?'&':'?')+'receiverId=sampleReceiver123';
  const call=async(p,method='GET',body,headers={})=>{
    const r=await worker.fetch(new Request(url(p),{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
    return {status:r.status,body:await r.json()};
  };
  assert.equal((await call('/api/provision','POST',{},{})).status,403);
  const provision=await call('/api/provision','POST',{}, {'x-owner-secret':'test-owner-secret'});
  assert.equal(provision.status,201);
  const receiverToken=provision.body.receiverToken;
  assert.equal((await call('/api/provision','POST',{}, {'x-owner-secret':'test-owner-secret'})).status,409);
  const auth={authorization:'Bearer '+receiverToken};
  const pair=await call('/api/pair/start','POST',{},auth);
  assert.equal(pair.status,200);
  assert.equal((await call('/api/pair/complete','POST',{code:pair.body.code})).status,409);
  assert.equal((await call('/api/pair/confirm','POST',{},auth)).status,200);
  const paired=await call('/api/pair/complete','POST',{code:pair.body.code});
  assert.equal(paired.status,200);
  const sender={authorization:'Bearer '+paired.body.senderToken};
  const first=await call('/api/animal/select','POST',{letter:'B',clientEventId:'bear-click-001'},sender);
  const retry=await call('/api/animal/select','POST',{letter:'B',clientEventId:'bear-click-001'},sender);
  const second=await call('/api/animal/select','POST',{letter:'B',clientEventId:'bear-click-002'},sender);
  assert.equal(first.body.commandId,1);
  assert.equal(retry.body.commandId,1);
  assert.equal(second.body.commandId,2);
  assert.equal((await call('/api/receiver/next?after=1','GET',undefined,auth)).body.command.commandId,2);
  assert.equal((await call('/api/receiver/next?after=2','GET',undefined,auth)).body.command,null);
  assert.equal((await call('/api/pair/revoke','POST',{},auth)).status,200);
  assert.equal((await call('/api/animal/select','POST',{letter:'A',clientEventId:'alligator-001'},sender)).status,403);
});
test('worker rejects missing routing ID and unsupported HTTP method',async()=>{
  const env={COL_RECEIVERS:{idFromName:x=>x,get:()=>{throw Error('unexpected')}}};
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/api/receiver/next'),env)).status,400);
  const instance=new ColReceiver({storage:new Storage()},{});
  const response=await instance.fetch(new Request('https://example.workers.dev/api/pair/start',{method:'PUT'}));
  assert.equal(response.status,405);
});

test('tablet browser origin is exact-match and preflight is bounded',async()=>{
  const env={TABLET_ALLOWED_ORIGIN:'https://col-animal-alphabet-preview.vercel.app',COL_RECEIVERS:{idFromName:x=>x,get:()=>new ColReceiver({storage:new Storage()},{})}};
  const endpoint='https://example.workers.dev/api/pair/start?receiverId=sampleReceiver123';
  const blocked=await worker.fetch(new Request(endpoint,{method:'POST',headers:{origin:'https://untrusted.example'},body:'{}'}),env);
  assert.equal(blocked.status,403);
  assert.equal(blocked.headers.get('access-control-allow-origin'),null);
  const preflight=await worker.fetch(new Request(endpoint,{method:'OPTIONS',headers:{origin:env.TABLET_ALLOWED_ORIGIN,'access-control-request-headers':'authorization, content-type'}}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),env.TABLET_ALLOWED_ORIGIN);
  const actual=await worker.fetch(new Request(endpoint,{method:'POST',headers:{origin:env.TABLET_ALLOWED_ORIGIN},body:'{}'}),env);
  assert.equal(actual.status,401);
  assert.equal(actual.headers.get('access-control-allow-origin'),env.TABLET_ALLOWED_ORIGIN);
});

test('durable command receipts stay bounded after repeated distinct taps',async()=>{
  const storage=new Storage();
  const {DurableCommandCore}=await import('./durable-core.mjs');
  const core=new DurableCommandCore(storage);
  for(let i=0;i<150;i++){
    const result=await core.select({letter:'B',clientEventId:'bear-event-'+String(i).padStart(4,'0')});
    assert.equal(result.status,200);
  }
  assert.equal((await storage.get('receiptQueue')).length,128);
  assert.equal(await storage.get('event:bear-event-0000'),undefined);
  assert.equal((await core.poll(149)).command.commandId,150);
});

test('pairing completion rejects high-volume guesses even without an active code',async()=>{
  const storage=new Storage(),instance=new ColReceiver({storage},{});
  const req=()=>new Request('https://example.workers.dev/api/pair/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'000000'})});
  for(let i=0;i<12;i++)assert.equal((await instance.fetch(req())).status,404);
  assert.equal((await instance.fetch(req())).status,429);
  assert.equal(await storage.get('guessWindowCount'),12);
});

test('POST body limit counts UTF-8 bytes, not just characters',async()=>{
  const instance=new ColReceiver({storage:new Storage()},{});
  const oversized='é'.repeat(1100);
  const req=new Request('https://example.workers.dev/api/pair/complete',{method:'POST',body:oversized});
  assert.equal((await instance.fetch(req)).status,413);
});

test('invalid UTF-8 body is rejected without a server exception',async()=>{
  const instance=new ColReceiver({storage:new Storage()},{});
  const req=new Request('https://example.workers.dev/api/pair/complete',{method:'POST',body:new Uint8Array([0xff,0xfe])});
  const response=await instance.fetch(req);
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'invalid_body');
});

test('CORS preflight rejects non-allowlisted custom headers',async()=>{
  const env={TABLET_ALLOWED_ORIGIN:'https://col-animal-alphabet-preview.vercel.app'};
  const response=await worker.fetch(new Request('https://example.workers.dev/api/pair/start?receiverId=sampleReceiver123',{method:'OPTIONS',headers:{origin:env.TABLET_ALLOWED_ORIGIN,'access-control-request-headers':'authorization, x-owner-secret'}}),env);
  assert.equal(response.status,403);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
});

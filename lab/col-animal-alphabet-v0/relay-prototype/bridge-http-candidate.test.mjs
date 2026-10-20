import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableReceiverSession} from './durable-session.mjs';
import {createBridgeRouter} from './bridge-http-candidate.mjs';
class Store {
  constructor(){this.data=new Map();}
  async get(k){return this.data.get(k);}
  async put(k,v){this.data.set(k,structuredClone(v));}
  async delete(k){this.data.delete(k);}
  async transaction(fn){return fn(this);}
}
test('single-receiver HTTPS route supports pairing and B→B with auth',async()=>{
  const session=new DurableReceiverSession(new Store());
  const {receiverToken}=await session.register({ownerAuthorized:true});
  const router=createBridgeRouter(session,{receiverId:'test-roku'});
  const call=async(path,method='GET',body,auth)=>{
    const res=await router(new Request('https://relay.example'+path,{method,headers:{...(auth?{authorization:'Bearer '+auth}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));
    return {status:res.status,data:await res.json()};
  };
  assert.equal((await call('/api/pair/start','POST',{},'wrong')).status,401);
  const pair=await call('/api/pair/start','POST',{},receiverToken);
  assert.equal(pair.status,200);
  assert.equal((await call('/api/pair/complete','POST',{code:pair.data.code})).status,409);
  assert.equal((await call('/api/pair/confirm','POST',{},receiverToken)).status,200);
  const complete=await call('/api/pair/complete','POST',{code:pair.data.code});
  const senderToken=complete.data.senderToken;
  assert.equal(complete.status,200);
  const a=await call('/api/animal/select','POST',{letter:'B',clientEventId:'tap-bear-001'},senderToken);
  const b=await call('/api/animal/select','POST',{letter:'B',clientEventId:'tap-bear-002'},senderToken);
  assert.equal(a.data.commandId,1);
  assert.equal(b.data.commandId,2);
  assert.equal((await call('/api/receiver/next?after=1','GET',null,receiverToken)).data.command.commandId,2);
  assert.equal((await call('/api/receiver/next?after=1&receiverId=other','GET',null,receiverToken)).status,404);
  assert.equal((await call('/api/pair/revoke','POST',{},receiverToken)).status,200);
  assert.equal((await call('/api/receiver/next?after=0','GET',null,receiverToken)).status,403);
});
test('router refuses plaintext, oversized payload and unsupported methods',async()=>{
  const router=createBridgeRouter(new DurableReceiverSession(new Store()),{receiverId:'tv'});
  assert.equal((await router(new Request('http://relay.example/api/receiver/next'))).status,400);
  assert.equal((await router(new Request('https://relay.example/api/pair/start',{method:'PUT'}))).status,405);
  assert.equal((await router(new Request('https://relay.example/api/pair/start',{method:'POST',body:'x'.repeat(2100)}))).status,413);
});

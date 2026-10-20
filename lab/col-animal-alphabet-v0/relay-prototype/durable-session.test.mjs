import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableReceiverSession} from './durable-session.mjs';
class Store {
  constructor(){this.data=new Map();}
  async get(k){return this.data.get(k);}
  async put(k,v){this.data.set(k,structuredClone(v));}
  async delete(k){this.data.delete(k);}
  async transaction(fn){return fn(this);}
}
test('owner registration, TV confirmation, pairing, repeated taps, revoke',async()=>{
  const store=new Store();let clock=1000;
  const receiver=new DurableReceiverSession(store,{now:()=>clock});
  assert.equal((await receiver.register()).status,403);
  const reg=await receiver.register({ownerAuthorized:true});
  assert.equal(reg.status,201);
  assert.equal((await receiver.register({ownerAuthorized:true})).status,409);
  assert.equal((await receiver.startPairing('wrong')).status,401);
  const pair=await receiver.startPairing(reg.receiverToken);
  assert.equal(pair.status,200);
  assert.equal((await receiver.completePairing(pair.code)).status,409);
  assert.equal((await receiver.confirmPairing(reg.receiverToken)).status,200);
  const sender=await receiver.completePairing(pair.code);
  assert.equal(sender.status,200);
  assert.equal((await receiver.completePairing(pair.code)).status,404);
  assert.equal((await receiver.select('wrong',{letter:'B',clientEventId:'tap-bear-001'})).status,401);
  const first=await receiver.select(sender.senderToken,{letter:'B',clientEventId:'tap-bear-001'});
  const second=await receiver.select(sender.senderToken,{letter:'B',clientEventId:'tap-bear-002'});
  assert.equal(first.commandId,1);assert.equal(second.commandId,2);
  assert.deepEqual((await receiver.poll(reg.receiverToken,1)).command,{commandId:2,letter:'B'});
  const restarted=new DurableReceiverSession(store,{now:()=>clock});
  assert.equal((await restarted.revoke(reg.receiverToken)).status,200);
  assert.equal((await restarted.select(sender.senderToken,{letter:'A',clientEventId:'tap-next-003'})).status,403);
  assert.equal((await restarted.poll(reg.receiverToken,0)).status,403);
});
test('pairing code expires and is not reusable',async()=>{
  const store=new Store();let clock=100;
  const receiver=new DurableReceiverSession(store,{now:()=>clock,pairingTtlMs:120000});
  const {receiverToken}=await receiver.register({ownerAuthorized:true});
  const {code}=await receiver.startPairing(receiverToken);
  clock=120100;
  assert.equal((await receiver.confirmPairing(receiverToken)).status,410);
  assert.equal((await receiver.completePairing(code)).status,404);
});

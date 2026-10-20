import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableCommandCore} from './durable-core.mjs';
class FakeStorage {
  constructor(){this.map=new Map();}
  async get(k){return this.map.get(k);}
  async put(k,v){this.map.set(k,structuredClone(v));}
  async transaction(fn){return fn(this);}
}
test('durable restart retains command and event idempotency',async()=>{
  const storage=new FakeStorage();
  const first=new DurableCommandCore(storage);
  assert.deepEqual(await first.select({letter:'B',clientEventId:'bear-tap-001'}),{status:200,commandId:1,letter:'B',deduplicated:false});
  const restarted=new DurableCommandCore(storage);
  assert.deepEqual(await restarted.select({letter:'B',clientEventId:'bear-tap-001'}),{status:200,commandId:1,letter:'B',deduplicated:true});
  assert.deepEqual(await restarted.select({letter:'B',clientEventId:'bear-tap-002'}),{status:200,commandId:2,letter:'B',deduplicated:false});
  assert.deepEqual(await restarted.poll(1),{status:200,command:{commandId:2,letter:'B'}});
  assert.deepEqual(await restarted.poll(2),{status:200,command:null});
});
test('reject invalid letters, cursors and reused event for another letter',async()=>{
  const core=new DurableCommandCore(new FakeStorage());
  assert.equal((await core.select({letter:'https://evil',clientEventId:'tap-valid-001'})).status,400);
  assert.equal((await core.select({letter:'B',clientEventId:'short'})).status,400);
  await core.select({letter:'B',clientEventId:'tap-valid-001'});
  assert.equal((await core.select({letter:'A',clientEventId:'tap-valid-001'})).status,409);
  assert.equal((await core.poll(-1)).status,400);
});

test('revocation persists across simulated restart and blocks select/poll',async()=>{
  const storage=new FakeStorage();
  const core=new DurableCommandCore(storage);
  await core.select({letter:'U',clientEventId:'urchin-tap-001'});
  assert.deepEqual(await core.revoke(),{status:200,revoked:true});
  const restarted=new DurableCommandCore(storage);
  assert.deepEqual(await restarted.select({letter:'B',clientEventId:'bear-tap-003'}),{status:403,error:'receiver_revoked'});
  assert.deepEqual(await restarted.poll(0),{status:403,error:'receiver_revoked'});
});

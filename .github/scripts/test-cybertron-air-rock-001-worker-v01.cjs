'use strict';
const assert=require('node:assert/strict');
const {C,digest,decision}=require('./cybertron-air-rock-001-worker-v01.cjs');
const f={ [C.fields.id]:C.id,[C.fields.status]:'READY',[C.fields.task]:C.task,
 [C.fields.payload]:C.payload,[C.fields.step]:1,[C.fields.max]:1 };
assert.equal(decision(f),'CLAIM');
assert.equal(decision({...f,[C.fields.status]:'CLAIMED',[C.fields.attempt]:C.attempt,[C.fields.claimed]:C.owner}),'RESUME');
const receipt=JSON.stringify({work_order:C.id,sha256:digest,production_write:false});
const done={...f,[C.fields.status]:'COMPLETE',[C.fields.attempt]:C.attempt,[C.fields.claimed]:C.owner,[C.fields.result]:digest,[C.fields.receipt]:receipt};
assert.equal(decision(done),'REPLAY');
for(const [key,value] of [['payload','NOT-KAW'],['id','OTHER'],['task','other'],['step',2],['max',2]])assert.throws(()=>decision({...f,[C.fields[key]]:value}),/CONTRACT_MISMATCH/);
assert.throws(()=>decision({...f,[C.fields.status]:'COMPLETE'}),/FOREIGN_COMPLETE/);
assert.throws(()=>decision({...f,[C.fields.attempt]:'foreign'}),/NOT_CLAIMABLE/);
assert.throws(()=>decision({...done,[C.fields.result]:'wrong'}),/FOREIGN_COMPLETE/);
assert.throws(()=>decision({...done,[C.fields.receipt]:'{}'}),/INVALID_RECEIPT/);
assert.match(digest,/^[a-f0-9]{64}$/);
console.log('AIR_ROCK_001_CONTRACT_PASS '+digest);

(async()=>{
 const m=require('./cybertron-air-rock-001-worker-v01.cjs');
 const originalFetch=global.fetch,originalToken=process.env.AIRTABLE_TOKEN;
 let state={...f},writes=[];
 process.env.AIRTABLE_TOKEN='mock-token-not-a-secret';
 global.fetch=async(url,opts)=>{
  assert.match(String(url),/recqLDb65ZOQyKxnl/);
  if(opts.method==='PATCH'){
   const patch=JSON.parse(opts.body).fields;writes.push(patch);state={...state,...patch};
  }
  return {ok:true,text:async()=>JSON.stringify({fields:state})};
 };
 try{
  await m.main();
  assert.equal(writes.length,2);
  assert.equal(state[C.fields.status],'COMPLETE');
  assert.equal(state[C.fields.result],digest);
  assert.equal(decision(state),'REPLAY');
  await m.main();
  assert.equal(writes.length,2,'replay must not write');
  console.log('AIR_ROCK_001_MOCKED_LIFECYCLE_PASS');
 }finally{
  global.fetch=originalFetch;
  if(originalToken===undefined)delete process.env.AIRTABLE_TOKEN;else process.env.AIRTABLE_TOKEN=originalToken;
 }
})().catch(e=>{console.error(e);process.exitCode=1});

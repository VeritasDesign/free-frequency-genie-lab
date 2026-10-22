'use strict';
const assert=require('node:assert/strict');
const {runBoundedHash,receiptFor,exactReceipt}=require('./bounded-fenced-hash-worker-v01.cjs');
const c=Object.freeze({recordId:'rec-ISOLATED-HASH',work_order_id:'CYB-ISOLATED-HASH',task_class:'harmless-hash',payload:'KAAAAAW',next_action:'produce local SHA256 receipt only'});
const ready=()=>({...c,status:'READY',step:0,max_attempts:1});
function fixture(){
 const state={lease:null,receipt:null,commits:0,claims:0,reads:0};
 const store={
  async tryClaim({work_order_id,attempt_id,owner}){
   state.claims++;
   if(state.lease||state.receipt)return null;
   state.lease={work_order_id,attempt_id,owner,fence:1,valid:true};
   return {...state.lease};
  },
  async readClaim(){return state.lease&&{...state.lease}},
  async commitReceipt(r){
   state.commits++;
   if(!state.lease||!state.lease.valid||state.receipt||state.lease.fence!==r.fence||
      state.lease.owner!==r.owner||state.lease.attempt_id!==r.attempt_id)return null;
   state.receipt={...r};return {...r};
  },
  async readReceipt(){state.reads++;return state.receipt&&{...state.receipt}}
 };
 return {state,store,args:{row:ready(),contract:c,attemptId:'ATTEMPT-A',owner:'RUNNER-A',claimStore:store,readOrder:async()=>ready()}};
}
const tests=[];function test(name,fn){tests.push([name,fn])}
test('one admitted worker emits exactly one durable hash receipt',async()=>{
 const x=fixture();const r=await runBoundedHash(x.args);
 assert.equal(r.status,'DURABLE_BOUNDED_HASH_COMPLETE');assert.match(r.digest,/^[0-9a-f]{64}$/);
 assert.equal(x.state.commits,1);assert.deepEqual(x.state.receipt.digest,r.digest);
});
test('repeated delivery cannot run twice',async()=>{
 const x=fixture();await runBoundedHash(x.args);
 await assert.rejects(runBoundedHash(x.args),/CLAIM_NOT_ACQUIRED/);
 assert.equal(x.state.commits,1);
});
test('foreign runner refused',async()=>{
 const x=fixture();x.state.lease={work_order_id:c.work_order_id,attempt_id:'OTHER',owner:'OTHER',fence:1,valid:true};
 await assert.rejects(runBoundedHash(x.args),/CLAIM_NOT_ACQUIRED/);assert.equal(x.state.commits,0);
});
test('unauthorized task refused before claim',async()=>{
 const x=fixture();await assert.rejects(runBoundedHash({...x.args,contract:{...c,task_class:'shell'}}),/TASK_CLASS_NOT_AUTHORIZED/);
 assert.equal(x.state.claims,0);
});
test('missing fenced adapter refused before claim',async()=>{
 const x=fixture();await assert.rejects(runBoundedHash({...x.args,claimStore:{tryClaim:x.store.tryClaim,readClaim:x.store.readClaim}}),/FENCED_RECEIPT_ADAPTER_REQUIRED/);
 assert.equal(x.state.claims,0);
});
test('terminal order refused before claim',async()=>{
 const x=fixture();await assert.rejects(runBoundedHash({...x.args,row:{...ready(),status:'COMPLETE'}}),/ORDER_NOT_READY/);
 assert.equal(x.state.commits,0);
});
test('dirty READY refused',async()=>{
 const x=fixture();await assert.rejects(runBoundedHash({...x.args,row:{...ready(),receipt:'old'}}),/DIRTY_READY_RECEIPT/);
 assert.equal(x.state.commits,0);
});
test('foreign contract refused',async()=>{
 const x=fixture();await assert.rejects(runBoundedHash({...x.args,row:{...ready(),payload:'DIFFERENT'}}),/ORDER_IDENTITY_PAYLOAD/);
 assert.equal(x.state.commits,0);
});
test('Airtable status change before execution refused',async()=>{
 const x=fixture();let reads=0;x.args.readOrder=async()=>++reads===1?ready():{...ready(),status:'BLOCKED'};
 await assert.rejects(runBoundedHash(x.args),/ORDER_NOT_READY/);assert.equal(x.state.commits,0);
});
test('lease expires between admission and fenced commit: no receipt',async()=>{
 const x=fixture();let reads=0;x.args.readOrder=async()=>{reads++;if(reads===2)x.state.lease.valid=false;return ready()};
 await assert.rejects(runBoundedHash(x.args),/FENCED_RECEIPT_NOT_COMMITTED/);assert.equal(x.state.receipt,null);
});
test('fence takeover between admission and commit: no receipt',async()=>{
 const x=fixture();let reads=0;x.args.readOrder=async()=>{reads++;if(reads===2){x.state.lease.fence=2;x.state.lease.owner='RUNNER-B'}return ready()};
 await assert.rejects(runBoundedHash(x.args),/FENCED_RECEIPT_NOT_COMMITTED/);assert.equal(x.state.receipt,null);
});
test('commit response lost but exact receipt durable: reconcile',async()=>{
 const x=fixture();const orig=x.store.commitReceipt;x.store.commitReceipt=async r=>{await orig(r);throw Error('lost ACK')};
 const r=await runBoundedHash(x.args);assert.equal(r.status,'DURABLE_RECEIPT_RECONCILED');assert.equal(x.state.commits,1);
});
test('commit response lost and no receipt: UNKNOWN',async()=>{
 const x=fixture();x.store.commitReceipt=async()=>{throw Error('lost ACK')};
 await assert.rejects(runBoundedHash(x.args),/RECEIPT_COMMIT_RESULT_UNKNOWN/);assert.equal(x.state.receipt,null);
});
test('commit response lost and receipt read fails: UNKNOWN',async()=>{
 const x=fixture();x.store.commitReceipt=async()=>{throw Error('lost ACK')};x.store.readReceipt=async()=>{throw Error('db offline')};
 await assert.rejects(runBoundedHash(x.args),/RECEIPT_COMMIT_RESULT_UNKNOWN/);
});
test('commit lies: readback mismatch rejected',async()=>{
 const x=fixture();x.store.commitReceipt=async r=>({...r});x.store.readReceipt=async()=>null;
 await assert.rejects(runBoundedHash(x.args),/DURABLE_RECEIPT_MISMATCH/);
});
test('commit reports foreign receipt: rejected',async()=>{
 const x=fixture();x.store.commitReceipt=async r=>({...r,owner:'OTHER'});
 await assert.rejects(runBoundedHash(x.args),/FENCED_RECEIPT_NOT_COMMITTED/);
});
test('readback unavailable after success: rejected',async()=>{
 const x=fixture();x.store.readReceipt=async()=>{throw Error('read down')};
 await assert.rejects(runBoundedHash(x.args),/DURABLE_RECEIPT_READBACK_FAILED/);
});
test('hash receipt is deterministic and tied to exact payload',async()=>{
 const a=receiptFor(c,{work_order_id:c.work_order_id,attempt_id:'A',owner:'X',fence:1});
 const b=receiptFor(c,{work_order_id:c.work_order_id,attempt_id:'A',owner:'X',fence:1});
 const changed=receiptFor({...c,payload:'OTHER'},{work_order_id:c.work_order_id,attempt_id:'A',owner:'X',fence:1});
 assert.equal(a.digest,b.digest);assert.notEqual(a.digest,changed.digest);assert(exactReceipt(a,b));
});
(async()=>{let count=0;for(const [name,fn] of tests){try{await fn();count++}catch(e){console.error('BOUNDED_HASH_OFFLINE_FAIL',name,e);process.exitCode=1;return}}console.log('CYBERTRON_BOUNDED_HASH_EXECUTOR_OFFLINE_PASS '+count+' cases; no external effects')})().catch(e=>{console.error(e);process.exitCode=1});

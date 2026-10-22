'use strict';
// Offline only: zero network, credentials, database, or executor.
const assert=require('node:assert/strict');
const {admit}=require('./atomic-claim-admission-v01.cjs');
const c=Object.freeze({recordId:'rec-ISOLATED-001',work_order_id:'CYB-CLAIM-ISOLATED-001',task_class:'harmless-hash',payload:'KAW',next_action:'Hash KAW; no deployment'});
const ready=()=>({...c,status:'READY',step:0,max_attempts:1,attempt_id:'',claimed_by:'',receipt:'',result:''});
const lease=(a='attempt-A',o='runner-A',f=1)=>({work_order_id:c.work_order_id,attempt_id:a,owner:o,fence:f,valid:true});
const store=(v=lease())=>({tryClaim:async()=>v,readClaim:async()=>v});
const args=(override={})=>({row:ready(),contract:c,attemptId:'attempt-A',owner:'runner-A',claimStore:store(),readOrder:async()=>ready(),...override});
const tests=[];const test=(n,fn)=>tests.push([n,fn]);
test('valid exact READY gets fenced admission',async()=>{const r=await admit(args());assert.equal(r.fence,1);assert.equal(r.status,'ADMITTED_FOR_BOUNDED_WORK');assert(Object.isFrozen(r))});
for(const [k,v] of [['status','COMPLETE'],['status','CLAIMED'],['attempt_id','foreign'],['claimed_by','foreign'],['receipt','some'],['result','some'],['step',1],['max_attempts',0],['task_class','foreign'],['payload','foreign'],['recordId','foreign'],['next_action','foreign']])
 test('reject dirty or foreign '+k,async()=>assert.rejects(admit(args({row:{...ready(),[k]:v}}))));
test('reject wrong initial order id',async()=>assert.rejects(admit(args({row:{...ready(),work_order_id:'foreign'}}))));
test('reject missing attempt',async()=>assert.rejects(admit(args({attemptId:''}))));
test('reject invalid ttl',async()=>assert.rejects(admit(args({ttlSeconds:10}))));
test('reject missing adapter',async()=>assert.rejects(admit(args({claimStore:{}}))));
test('reject foreign existing lease',async()=>assert.rejects(admit(args({claimStore:store(lease('foreign','other'))}))));
test('reject no claim winner',async()=>assert.rejects(admit(args({claimStore:store(null)})),/CLAIM_NOT_ACQUIRED/));
test('reject expired lease',async()=>assert.rejects(admit(args({claimStore:store({...lease(),valid:false})}))));
test('reject stale fence after read',async()=>{let n=0;const claimStore={tryClaim:async()=>lease(),readClaim:async()=>++n===1?lease():lease('attempt-A','runner-A',2)};await assert.rejects(admit(args({claimStore})),/CLAIM_FENCE_CHANGED/)});
test('reject Airtable mutation after claim',async()=>assert.rejects(admit(args({readOrder:async()=>({...ready(),status:'BLOCKED'})})),/ORDER_NOT_READY/));
test('reject foreign ownership after read',async()=>{let n=0;const claimStore={tryClaim:async()=>lease(),readClaim:async()=>++n===2?lease('foreign','other'):lease()};await assert.rejects(admit(args({claimStore})),/OWNERSHIP_NOT_VERIFIED/)});
test('recover lost response with exact durable owner',async()=>{const claimStore={tryClaim:async()=>{throw Error('network reset')},readClaim:async()=>lease()};assert.equal((await admit(args({claimStore}))).fence,1)});
test('lost response foreign owner fails closed',async()=>{const claimStore={tryClaim:async()=>{throw Error('network reset')},readClaim:async()=>lease('foreign','other')};await assert.rejects(admit(args({claimStore})),/CLAIM_RESULT_UNKNOWN/)});
test('lost response no readback fails closed',async()=>{const claimStore={tryClaim:async()=>{throw Error('network reset')},readClaim:async()=>{throw Error('db down')}};await assert.rejects(admit(args({claimStore})),/CLAIM_RESULT_UNKNOWN/)});
test('READY metadata cannot bypass missing claim',async()=>{let called=false;const claimStore={tryClaim:async()=>{called=true;return null},readClaim:async()=>lease()};await assert.rejects(admit(args({claimStore})),/CLAIM_NOT_ACQUIRED/);assert(called)});
(async()=>{let n=0;for(const [name,fn] of tests){try{await fn();n++}catch(e){console.error('FAIL',name,e);process.exitCode=1;return}}console.log('CYBERTRON_ATOMIC_ADMISSION_OFFLINE_PASS '+n+' scenarios; zero external writes; no executor invoked')})().catch(e=>{console.error(e);process.exitCode=1});

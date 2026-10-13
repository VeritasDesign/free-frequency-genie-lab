'use strict';
// Bounded ROCK -> Factory handoff contract. No remote calls or writes.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {C,digest,decision}=require('./cybertron-air-rock-001-worker-v01.cjs');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const work={id:'CYB-FACTORY-ACTUAL-HANDLER-001',source:'VeritasDesign/free-frequency-factory/apps/private-hq/api/critter-run.js',mode:'isolated-fixture',chain:['Owl','Echo','Beaver','Beetle','Hawk','Jane','Harvest']};
const receipt={work_order:C.id,attempt:C.attempt,worker:C.owner,algorithm:'SHA-256',encoding:'UTF-8',bytes:3,sha256:digest,production_write:false,deploy:false};
const fields={[C.fields.id]:C.id,[C.fields.status]:'COMPLETE',[C.fields.task]:C.task,[C.fields.payload]:C.payload,[C.fields.step]:C.step,[C.fields.max]:C.max,[C.fields.attempt]:C.attempt,[C.fields.claimed]:C.owner,[C.fields.result]:digest,[C.fields.receipt]:JSON.stringify(receipt)};
function qualify(f,req){
 assert.equal(decision(f),'REPLAY','ROCK_RECEIPT_NOT_COMPLETE');
 assert.equal(req.mode,'isolated-fixture','PRODUCTION_NOT_AUTHORIZED');
 assert.equal(req.id,work.id,'WORK_ORDER_NOT_ALLOWLISTED');
 assert.equal(req.source,work.source,'HANDLER_SOURCE_MISMATCH');
 assert.deepEqual(req.chain,work.chain,'CHAIN_MISMATCH');
 assert.equal(req.squirrel,'RUNNING','SQUIRREL_PAUSED');
 assert.equal(req.hawk_gate,'GREEN','HAWK_NOT_GREEN');
 assert.equal(req.authorized_live_write,false,'LIVE_WRITE_NOT_AUTHORIZED');
 return Object.freeze({schema:'CybertronRockFactoryHandoff/v0.1',rock_work_order:C.id,rock_receipt_sha256:sha(receipt),factory_work_order:req.id,source:req.source,mode:req.mode,allowed_steps:req.chain,production_write:false,deploy:false,execute:false});
}
const valid={...work,squirrel:'RUNNING',hawk_gate:'GREEN',authorized_live_write:false};
const handoff=qualify(fields,valid);
assert.throws(()=>qualify(fields,{...valid,squirrel:'PAUSED'}),/SQUIRREL_PAUSED/);
assert.throws(()=>qualify(fields,{...valid,hawk_gate:'RED'}),/HAWK_NOT_GREEN/);
assert.throws(()=>qualify(fields,{...valid,authorized_live_write:true}),/LIVE_WRITE_NOT_AUTHORIZED/);
assert.throws(()=>qualify(fields,{...valid,mode:'production'}),/PRODUCTION_NOT_AUTHORIZED/);
assert.throws(()=>qualify(fields,{...valid,id:'OTHER'}),/WORK_ORDER_NOT_ALLOWLISTED/);
assert.throws(()=>qualify({...fields,[C.fields.result]:'wrong'},valid),/FOREIGN_COMPLETE/);
console.log('ROCK_FACTORY_HANDOFF_CONTRACT_PASS '+sha(handoff));
console.log('ROCK_FACTORY_HANDOFF_RECEIPT '+JSON.stringify(handoff));

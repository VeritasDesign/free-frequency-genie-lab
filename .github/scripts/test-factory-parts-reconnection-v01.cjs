'use strict';
// Isolated contract test: existing ROCK worker + recovered Critter/Squirrel/Harvest stages.
// Does not execute the private-HQ handler or write any remote store.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {C,digest,decision}=require('./cybertron-air-rock-001-worker-v01.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
const source='VeritasDesign/free-frequency-factory/apps/private-hq/api/critter-run.js';
const fixture={work_order:'CYB-PARTS-RECONNECT-TEST-001',source,gate:'GREEN',squirrel:'RUNNING',stage:'INPUT',parts:[],events:[]};
function step(s,stage){
  assert.equal(s.squirrel,'RUNNING','SQUIRREL_PAUSED');
  assert.equal(s.gate,'GREEN','HAWK_GATE_NOT_GREEN');
  const order=['INPUT','OWNER','WORK','OUTPUT','REVIEW','HARVEST','MEMORY'];
  assert.equal(stage,order[order.indexOf(s.stage)+1],'STAGE_ORDER');
  s.events.push(stage);s.stage=stage;
  if(stage==='HARVEST')s.parts.push({source_work_id:s.work_order,part:'isolated-fixture',verified:true});
}
const paused=structuredClone(fixture);paused.squirrel='PAUSED';
assert.throws(()=>step(paused,'OWNER'),/SQUIRREL_PAUSED/);
assert.equal(paused.events.length,0);assert.equal(paused.parts.length,0);
const rejected=structuredClone(fixture);rejected.gate='RED';
assert.throws(()=>step(rejected,'OWNER'),/HAWK_GATE_NOT_GREEN/);
for(const stage of ['OWNER','WORK','OUTPUT','REVIEW','HARVEST','MEMORY'])step(fixture,stage);
assert.equal(fixture.parts.length,1);
assert.equal(fixture.parts[0].source_work_id,fixture.work_order);
const receipt={schema:'CybertronPartsReconnectionFixture/v0.1',source,work_order:fixture.work_order,stage:fixture.stage,stages:fixture.events,part:fixture.parts[0],rock_sha256:digest,remote_writes:0,production_deploy:false,classification:'ISOLATED_CONTRACT_FIXTURE_ONLY'};
const encoded=JSON.stringify(receipt);const receiptSha=hash(encoded);
const fields={[C.fields.id]:C.id,[C.fields.status]:'COMPLETE',[C.fields.task]:C.task,[C.fields.payload]:C.payload,[C.fields.step]:1,[C.fields.max]:1,[C.fields.attempt]:C.attempt,[C.fields.claimed]:C.owner,[C.fields.result]:digest,[C.fields.receipt]:JSON.stringify({work_order:C.id,attempt:C.attempt,worker:C.owner,algorithm:'SHA-256',encoding:'UTF-8',bytes:3,sha256:digest,production_write:false,deploy:false})};
assert.equal(decision(fields),'REPLAY');
assert.equal(receipt.rock_sha256,digest);
console.log('FACTORY_PARTS_RECONNECTION_FIXTURE_PASS '+receiptSha);
console.log('FACTORY_PARTS_RECEIPT '+encoded);

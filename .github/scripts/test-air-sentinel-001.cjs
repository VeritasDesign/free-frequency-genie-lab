'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const d=require('./cybertron-airtable-sentinel-dispatcher-v01.cjs');
const b=require('./air-sentinel-001-builder.cjs');
const f=()=>Object.fromEntries(Object.entries({id:d.C.id,task:d.C.task,payload:d.C.payload,next:d.C.next,status:'READY'}).map(([k,v])=>[d.C.fields[k],v]));
test('exact supported order applies',()=>assert.equal(d.validate(f()),'APPLY'));
test('same attempt resumes',()=>{const a=f();a[d.C.fields.status]='CLAIMED';a[d.C.fields.attempt]=d.C.attempt;a[d.C.fields.claimed]=d.C.claimed;assert.equal(d.validate(a),'RESUME')});
test('terminal order replays only with durable receipt',()=>{const a=f();a[d.C.fields.status]='COMPLETE';a[d.C.fields.attempt]=d.C.attempt;a[d.C.fields.claimed]=d.C.claimed;assert.throws(()=>d.validate(a));a[d.C.fields.result]='https://github.com/VeritasDesign/free-frequency-genie-lab/pull/1';a[d.C.fields.receipt]=JSON.stringify({status:'COMPLETE',attempt:d.C.attempt,production_write:false,deploy:false});assert.equal(d.validate(a),'REPLAY')});
test('mismatches and foreign claims fail closed',()=>{for(const k of ['id','task','payload','next','status','attempt','claimed']){const a=f();a[d.C.fields[k]]='other';assert.throws(()=>d.validate(a),k)}});
test('trusted transformation rejects drift and repeats',()=>{assert.equal(b.replaceOnce('a xyz b','xyz','123'),'a 123 b');assert.throws(()=>b.replaceOnce('no','xyz','123'));assert.throws(()=>b.replaceOnce('xyz xyz','xyz','123'))});
const resume=require('./air-sentinel-001-resume.cjs');
test('resume only reuses same order and proven source/evidence',()=>{
 const x={parents:['candidate',b.PIN],changed:[b.ROOT+'src/app.js'],provenance:{work_order:d.C.id,attempt:d.C.attempt,source_commit:b.PIN,production_write:false,deploy:false},verification:{status:'PASS',source_commit:b.PIN,live_nws:{status:'PASS'},browser_fixture_tests:[{},{}]}};
 assert.equal(resume.validateResume(x),true);assert.throws(()=>resume.validateResume({...x,parents:['candidate','other']}));assert.throws(()=>resume.validateResume({...x,changed:['other.js']}));assert.throws(()=>resume.validateResume({...x,provenance:{...x.provenance,production_write:true}}));assert.throws(()=>resume.validateResume({...x,verification:{...x.verification,status:'FAIL'}}));
});

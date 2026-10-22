'use strict';
const assert=require('node:assert/strict');
const {C,v}=require('./cybertron-airtable-ready-dispatcher-v02.cjs');
const F=C.fields;
const fields=(status='READY')=>({
 [F.id]:C.id,[F.task]:C.task,[F.payload]:C.payload,[F.next]:C.next,[F.status]:status,
 [F.attempt]:'',[F.claimed]:'',[F.result]:'',[F.receipt]:''
});
const fails=(f,code)=>assert.throws(()=>v(f),e=>e.message===code);
assert.equal(v(fields()),'APPLY');
for(const key of ['id','task','payload','next']){
 const f=fields();f[F[key]]='substituted';fails(f,({id:'WORK_ORDER_MISMATCH',task:'TASK_CLASS_MISMATCH',payload:'PAYLOAD_MISMATCH',next:'NEXT_ACTION_MISMATCH'})[key]);
}
for(const key of ['attempt','claimed','result','receipt']){
 const f=fields();f[F[key]]='unexpected';fails(f,'ALREADY_CLAIMED_OR_COMPLETED');
}
const claimed=fields('CLAIMED');claimed[F.attempt]=C.exec;claimed[F.claimed]='Cybertron READY Dispatcher v0.2';
assert.equal(v(claimed),'RESUME');
for(const key of ['attempt','claimed','result','receipt']){
 const f={...claimed};f[F[key]]='foreign';fails(f,'FOREIGN_OR_AMBIGUOUS_CLAIM');
}
const completed=fields('COMPLETE');completed[F.attempt]=C.exec;completed[F.claimed]='Cybertron READY Dispatcher v0.2';
fails(completed,'COMPLETION_RECEIPT_NOT_QUALIFIED');
for(const key of ['attempt','claimed']){
 const f={...completed};f[F[key]]='foreign';fails(f,'FOREIGN_COMPLETE');
}
fails(fields('BLOCKED'),'STATUS_NOT_READY');
console.log('CYBERTRON_READY_DISPATCH_DECISION_PASS 18 isolated scenarios; no Airtable requests or writes');

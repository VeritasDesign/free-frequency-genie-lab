'use strict';

const C={
 base:'app01sBuNbRyjVt47',table:'tbl3ZPAJF3FvbR90p',record:'recWEeaey6ELGw48P',
 id:'AIR-REAL-001',task:'factory-build',
 payload:'Build a durable CYBERTRON VERIFIED CLOSED LOOP checkpoint artifact from the accepted AIR-ROCK evidence. Artifact must distinguish VERIFIED mechanisms from NOT YET VERIFIED automation, include run/receipt IDs, and make no production changes.',
 next:'Factory builds branch/PR artifact; deterministic verifier checks evidence and classification; persist receipt; no merge/deploy.',
 exec:'AIR-REAL-001-DISPATCH-1',
 fields:{id:'fldn5b6yeYYRMPSaM',status:'fldgOSvL9pxpNRL2I',task:'fldHLUnihNBexSkZn',payload:'fldlnFmNjotAB08qm',attempt:'fldyMDCSTEW46XKZV',claimed:'fldjB7m1c9jaMhNKR',receipt:'fldO9RGHuCX7Bv0q0',result:'flde4kea7ckvPVn2g',next:'fldTpHDML0gVrtGk5'}
};
const artifact=`# CYBERTRON VERIFIED CLOSED LOOP — 2026-10-06

State: VERIFIED CLOSED LOOP for the bounded AIR-ROCK control-path experiment.

## VERIFIED
- Persistent Airtable work state and durable readback.
- Evidence-driven replan: AIR-ROCK-003A selected ADAPTIVE-B and superseded LEGACY-A.
- Bounded deterministic actuation: AIR-ROCK-003B completed through Cybertron Airtable Actuator v0.1.
- Fail-closed contract enforcement: first live actuator attempt refused mismatched representation without mutating Airtable.
- Corrected actuator live run 37532486848 succeeded; job 112505126982 emitted VERIFIED_COMPLETE.
- Independent Airtable readback confirmed AIR-ROCK-003B COMPLETE with execution AIR-ROCK-003B-ACTUATOR-1 and result 36703db01266e420880b5ee3f6ce094a957fa7920ce9b387d11e4bc38ecce41d.
- Durable live receipt is recorded on issue #111 comment 6025596878.

## NOT YET VERIFIED BY THE ROCK
- General-purpose autonomous dispatch for arbitrary task classes.
- Production deployment authority or production writes.
- Unbounded self-modification or authority expansion.

## AUTHORITY
Cybertron may recursively improve methods; it may not recursively expand authority. Shannon retains consequential deployment authority.

## CLASSIFICATION
This checkpoint does not claim that every Cybertron component is autonomous or production-ready. It records the bounded mechanisms actually evidenced above.
`;
function v(f){
 const x=k=>f[C.fields[k]]??'';
 if(x('id')!==C.id)throw Error('WORK_ORDER_MISMATCH');
 if(x('task')!==C.task)throw Error('TASK_CLASS_MISMATCH');
 if(x('payload')!==C.payload)throw Error('PAYLOAD_MISMATCH');
 if(x('next')!==C.next)throw Error('NEXT_ACTION_MISMATCH');
 if(x('status')==='COMPLETE'&&x('attempt')===C.exec)return 'REPLAY';
 if(x('status')!=='READY')throw Error('STATUS_NOT_READY');
 if(x('attempt')||x('claimed')||x('result'))throw Error('ALREADY_CLAIMED_OR_COMPLETED');
 return 'APPLY';
}
async function req(token,method,body){
 const u=`https://api.airtable.com/v0/${C.base}/${C.table}/${C.record}?returnFieldsByFieldId=true`;
 const r=await fetch(u,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 const t=await r.text();if(!r.ok)throw Error('AIRTABLE_'+r.status+':'+t.slice(0,200));return JSON.parse(t);
}
async function main(){
 const token=process.env.AIRTABLE_TOKEN;if(!token)throw Error('AIRTABLE_TOKEN_REQUIRED');
 const before=await req(token,'GET');const d=v(before.fields||{});
 if(d==='REPLAY'){console.log('DISPATCH_REPLAY');return;}
 await req(token,'PATCH',{fields:{[C.fields.status]:'CLAIMED',[C.fields.attempt]:C.exec,[C.fields.claimed]:'Cybertron READY Dispatcher v0.1'}});
 console.log('DISPATCH_CLAIMED '+C.id);
}
module.exports={C,artifact,v,req,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1)});

'use strict';
const assert=require('node:assert/strict');
const {F,qualifySchema,mapRecord,inventory,BASE_ID,TABLE_ID}=require('./airtable-work-order-readonly-bridge-v01.cjs');
const names={
 work_order_id:['Work Order ID','singleLineText'],status:['Status','singleSelect'],
 task_class:['Task Class','singleLineText'],payload:['Payload','multilineText'],
 step:['Step','number'],max_attempts:['Max Attempts','number'],
 attempt_id:['Attempt ID','singleLineText'],claimed_by:['Claimed By','singleLineText'],
 receipt:['Receipt','multilineText'],result:['Result','multilineText'],
 next_action:['Next Action','multilineText']
};
const schema=()=>({tables:[{id:TABLE_ID,name:'Work Orders',fields:Object.entries(F).map(([k,id])=>({id,name:names[k][0],type:names[k][1]}))}]});
const record=(id,status='COMPLETE',task='harmless-hash')=>({id,cellValuesByFieldId:{
 [F.work_order_id]:'AIR-ISOLATED-'+id.slice(-2),[F.status]:{name:status},
 [F.task_class]:task,[F.payload]:'KAW',[F.step]:2,[F.max_attempts]:1,
 [F.attempt_id]:'ATTEMPT-A',[F.claimed_by]:'RUNNER-A',
 [F.receipt]:status==='COMPLETE'?'existing receipt':null,
 [F.result]:status==='COMPLETE'?'existing result':null,[F.next_action]:'none'
}});
const tests=[];const test=(n,f)=>tests.push([n,f]);
test('known live schema IDs and field types qualified',()=>{
 const result=qualifySchema(schema());assert.equal(result.baseId,BASE_ID);assert.equal(result.claimAuthority,'NOT_AIRTABLE');
});
test('schema field type drift refused',()=>{
 const x=schema();x.tables[0].fields[0].type='number';
 assert.throws(()=>qualifySchema(x),/AIRTABLE_FIELD_DRIFT_WORK_ORDER_ID/);
});
test('wrong table refused',()=>{
 const x=schema();x.tables[0].id='tblOTHER';
 assert.throws(()=>qualifySchema(x),/AIRTABLE_TABLE_DRIFT/);
});
test('legacy workflow Step 2 max attempts 1 never becomes claim generation',()=>{
 const x=mapRecord(record('recAAAAAAAAAAAAAA'));
 assert.equal(x.workflow_step,2);assert.equal(x.max_attempts,1);
 assert.equal(x.claim_generation,null);assert.equal(x.fence,null);assert.equal(x.execution_authorized,false);
});
test('READY is never authorized by Airtable read',()=>{
 const x=mapRecord(record('recBBBBBBBBBBBBBB','READY'));
 assert.equal(x.status,'READY');assert.equal(x.execution_authorized,false);
});
test('CLAIMED is never an atomic claim',()=>{
 const x=mapRecord(record('recCCCCCCCCCCCCCC','CLAIMED'));
 assert.equal(x.claimed_by,'RUNNER-A');assert.equal(x.claim_authority,'UNVERIFIED_DATABASE_CONNECTION');
});
test('blocked work order not dispatched',()=>{
 const x=mapRecord(record('recDDDDDDDDDDDDDD','BLOCKED','read-only-archaeology'));
 assert.equal(x.execution_authorized,false);
});
test('unknown status fails closed',()=>{
 assert.throws(()=>mapRecord(record('recEEEEEEEEEEEEEE','QUEUED')),/AIRTABLE_STATUS_UNKNOWN/);
});
test('invalid record id refused',()=>{
 assert.throws(()=>mapRecord(record('fake','COMPLETE')),/AIRTABLE_RECORD_INVALID/);
});
test('duplicate work order refused',()=>{
 const a=record('recFFFFFFFFFFFFFF'),b=record('recGGGGGGGGGGGGGG');
 b.cellValuesByFieldId[F.work_order_id]=a.cellValuesByFieldId[F.work_order_id];
 assert.throws(()=>inventory([a,b]),/AIRTABLE_DUPLICATE_ID/);
});
test('read-only inventory counts without authorization',()=>{
 const a=record('recHHHHHHHHHHHHHH','COMPLETE');
 const b=record('recIIIIIIIIIIIIII','BLOCKED');
 const x=inventory([a,b]);assert.equal(x.counts.COMPLETE,1);assert.equal(x.counts.BLOCKED,1);
 assert.equal(x.execution_authorized,false);
});
(async()=>{for(const [name,fn] of tests){try{fn()}catch(e){console.error('AIRTABLE_READONLY_BRIDGE_FAIL',name,e);process.exitCode=1;return}}
 console.log('CYBERTRON_AIRTABLE_READONLY_BRIDGE_PASS '+tests.length+' scenarios; schema/legacy-step guarded; no network or writes')})();

'use strict';
// READ-ONLY adapter for the *existing* Free Frequency Airtable ROCK table.
// Not a dispatcher, not a claim, not an Airtable PATCH, not a DB connection.
// The legacy Step field is workflow progress, NEVER a claim generation.
// Fencing and claim_generation live only in a separately verified DB adapter.
const BASE_ID='app01sBuNbRyjVt47',TABLE_ID='tbl3ZPAJF3FvbR90p';
const F=Object.freeze({
 work_order_id:'fldn5b6yeYYRMPSaM',status:'fldgOSvL9pxpNRL2I',
 task_class:'fldHLUnihNBexSkZn',payload:'fldlnFmNjotAB08qm',
 step:'fldZz2dIKt7hoxxdD',max_attempts:'fldNVK0fO1mlCvRVJ',
 attempt_id:'fldyMDCSTEW46XKZV',claimed_by:'fldjB7m1c9jaMhNKR',
 receipt:'fldO9RGHuCX7Bv0q0',result:'flde4kea7ckvPVn2g',
 next_action:'fldTpHDML0gVrtGk5'
});
const fail=c=>{throw Error(c)};
function qualifySchema(base){
 if(!base||!Array.isArray(base.tables))fail('AIRTABLE_SCHEMA_MISSING');
 const table=base.tables.find(t=>t.id===TABLE_ID);
 if(!table||table.name!=='Work Orders'||!Array.isArray(table.fields))fail('AIRTABLE_TABLE_DRIFT');
 const required={
  work_order_id:['Work Order ID','singleLineText'],status:['Status','singleSelect'],
  task_class:['Task Class','singleLineText'],payload:['Payload','multilineText'],
  step:['Step','number'],max_attempts:['Max Attempts','number'],
  attempt_id:['Attempt ID','singleLineText'],claimed_by:['Claimed By','singleLineText'],
  receipt:['Receipt','multilineText'],result:['Result','multilineText'],
  next_action:['Next Action','multilineText']
 };
 for(const [key,[name,type]] of Object.entries(required)){
  const found=table.fields.find(f=>f.id===F[key]);
  if(!found||found.name!==name||found.type!==type)fail('AIRTABLE_FIELD_DRIFT_'+key.toUpperCase());
 }
 if(table.fields.some(f=>/^(fence|claim generation|lease expires)$/i.test(f.name)))fail('AIRTABLE_SCHEMA_UNEXPECTED_LOCK_FIELD');
 return Object.freeze({baseId:BASE_ID,tableId:TABLE_ID,fieldIds:F,claimAuthority:'NOT_AIRTABLE'});
}
function mapRecord(record){
 if(!record||!/^rec[A-Za-z0-9]{14}$/.test(record.id)||!record.cellValuesByFieldId)fail('AIRTABLE_RECORD_INVALID');
 const v=record.cellValuesByFieldId,field=k=>v[F[k]]??null;
 const status=field('status')?.name;
 if(!['READY','CLAIMED','COMPLETE','BLOCKED'].includes(status))fail('AIRTABLE_STATUS_UNKNOWN');
 if(typeof field('work_order_id')!=='string'||!field('work_order_id').trim()||
    typeof field('task_class')!=='string'||!field('task_class').trim())fail('AIRTABLE_IDENTITY_INVALID');
 return Object.freeze({
  recordId:record.id,work_order_id:field('work_order_id'),status,
  task_class:field('task_class'),payload:field('payload'),
  workflow_step:field('step'),max_attempts:field('max_attempts'),
  attempt_id:field('attempt_id'),claimed_by:field('claimed_by'),
  receipt:field('receipt'),result:field('result'),next_action:field('next_action'),
  // Never fabricate a DB fence or claim-generation from Airtable Step.
  fence:null,claim_generation:null,execution_authorized:false,
  claim_authority:'UNVERIFIED_DATABASE_CONNECTION'
 });
}
function inventory(records){
 if(!Array.isArray(records))fail('AIRTABLE_RECORDS_INVALID');
 const ids=new Set(),orderIds=new Set(),counts={READY:0,CLAIMED:0,COMPLETE:0,BLOCKED:0};
 const mapped=records.map(record=>{
  const m=mapRecord(record);
  if(ids.has(m.recordId)||orderIds.has(m.work_order_id))fail('AIRTABLE_DUPLICATE_ID');
  ids.add(m.recordId);orderIds.add(m.work_order_id);counts[m.status]++;return m;
 });
 return Object.freeze({counts,records:mapped,claimAuthority:'UNVERIFIED_DATABASE_CONNECTION',execution_authorized:false});
}
module.exports={BASE_ID,TABLE_ID,F,qualifySchema,mapRecord,inventory};

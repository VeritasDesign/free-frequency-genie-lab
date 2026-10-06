'use strict';

const CONTRACT = Object.freeze({
  baseId: 'app01sBuNbRyjVt47',
  tableId: 'tbl3ZPAJF3FvbR90p',
  recordId: 'recvD8hQ0zwq9hsfZ',
  workOrderId: 'AIR-ROCK-003B',
  taskClass: 'revised-route-execution',
  status: 'READY',
  payload: 'SELECTED_ROUTE=ADAPTIVE-B; SUPERSEDES=LEGACY-A; EVIDENCE_FROM=AIR-ROCK-003A',
  nextAction: 'Execute revised ADAPTIVE-B route; do not execute superseded LEGACY-A',
  executionId: 'AIR-ROCK-003B-ACTUATOR-1',
  result: '36703db01266e420880b5ee3f6ce094a957fa7920ce9b387d11e4bc38ecce41d'
});

function assertTarget(baseId, tableId, recordId) {
  if (baseId !== CONTRACT.baseId || tableId !== CONTRACT.tableId || recordId !== CONTRACT.recordId)
    throw new Error('TARGET_NOT_ALLOWLISTED');
}
function cell(fields, id) { return fields[id] ?? ''; }
function validate(fields) {
  if (cell(fields,'fldn5b6yeYYRMPSaM') !== CONTRACT.workOrderId) throw new Error('WORK_ORDER_MISMATCH');
  const existingExec=cell(fields,'fldyMDCSTEW46XKZV'), existingResult=cell(fields,'flde4kea7ckvPVn2g');
  if (cell(fields,'fldgOSvL9pxpNRL2I') === 'COMPLETE' && existingExec === CONTRACT.executionId && existingResult === CONTRACT.result)
    return 'REPLAY';
  if (cell(fields,'fldgOSvL9pxpNRL2I') !== CONTRACT.status) throw new Error('STATUS_MISMATCH');
  if (cell(fields,'fldHLUnihNBexSkZn') !== CONTRACT.taskClass) throw new Error('TASK_CLASS_MISMATCH');
  if (cell(fields,'fldlnFmNjotAB08qm') !== CONTRACT.payload) throw new Error('ROUTE_MISMATCH');
  if (cell(fields,'fldTpHDML0gVrtGk5') !== CONTRACT.nextAction) throw new Error('NEXT_ACTION_MISMATCH');
  if (existingExec || existingResult || cell(fields,'fldjB7m1c9jaMhNKR')) throw new Error('COMPLETION_FIELDS_NOT_EMPTY');
  return 'APPLY';
}
function patch() {
  return {
    fldgOSvL9pxpNRL2I:'COMPLETE',
    fldyMDCSTEW46XKZV:CONTRACT.executionId,
    fldjB7m1c9jaMhNKR:'Cybertron Airtable Actuator v0.1',
    flde4kea7ckvPVn2g:CONTRACT.result,
    fldO9RGHuCX7Bv0q0:'ACTUATOR RECEIPT: exact AIR-ROCK-003B ADAPTIVE-B preconditions accepted; superseded LEGACY-A refused; deterministic result persisted; execution_id='+CONTRACT.executionId,
    fldTpHDML0gVrtGk5:'Recursive ROCK complete — await human review'
  };
}
async function request(token, method, url, body) {
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{}
  if(!r.ok) throw new Error('AIRTABLE_HTTP_'+r.status+': '+text.slice(0,300));
  return data;
}
async function run({token,baseId=CONTRACT.baseId,tableId=CONTRACT.tableId,recordId=CONTRACT.recordId,dryRun=false,fixture=null}={}) {
  assertTarget(baseId,tableId,recordId);
  if(!token && !fixture) throw new Error('AIRTABLE_TOKEN_REQUIRED');
  const url='https://api.airtable.com/v0/'+baseId+'/'+tableId+'/'+recordId+'?returnFieldsByFieldId=true';
  const before=fixture || await request(token,'GET',url);
  const decision=validate(before.fields||{});
  if(decision==='REPLAY') return {status:'VERIFIED_REPLAY',execution_id:CONTRACT.executionId,result:CONTRACT.result};
  if(dryRun || fixture) return {status:'DRY_RUN_ACCEPTED',patch:patch()};
  await request(token,'PATCH',url,{fields:patch(),typecast:false});
  const after=await request(token,'GET',url);
  if(validate(after.fields||{})!=='REPLAY') throw new Error('READBACK_VERIFICATION_FAILED');
  return {status:'VERIFIED_COMPLETE',execution_id:CONTRACT.executionId,result:CONTRACT.result};
}
module.exports={CONTRACT,assertTarget,validate,patch,run};
if(require.main===module) run({token:process.env.AIRTABLE_TOKEN}).then(x=>console.log('CYBERTRON_AIRTABLE_ACTUATOR_RECEIPT '+JSON.stringify(x))).catch(e=>{console.error(e.message);process.exit(1);});

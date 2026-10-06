'use strict';
const assert=require('assert'); const a=require('./cybertron-airtable-actuator-v01.cjs');
const C=a.CONTRACT;
function good(){return {fields:{fldn5b6yeYYRMPSaM:C.workOrderId,fldgOSvL9pxpNRL2I:'READY',fldHLUnihNBexSkZn:C.taskClass,fldlnFmNjotAB08qm:C.payload,fldTpHDML0gVrtGk5:C.nextAction,fldyMDCSTEW46XKZV:'',flde4kea7ckvPVn2g:'',fldjB7m1c9jaMhNKR:''}}}
function rejects(fn,msg){assert.throws(fn,new RegExp(msg));}
(async()=>{
 rejects(()=>a.assertTarget('bad',C.tableId,C.recordId),'TARGET_NOT_ALLOWLISTED');
 rejects(()=>a.assertTarget(C.baseId,'bad',C.recordId),'TARGET_NOT_ALLOWLISTED');
 rejects(()=>a.assertTarget(C.baseId,C.tableId,'bad'),'TARGET_NOT_ALLOWLISTED');
 let x=good(); x.fields.fldgOSvL9pxpNRL2I='BLOCKED'; rejects(()=>a.validate(x.fields),'STATUS_MISMATCH');
 x=good(); x.fields.fldlnFmNjotAB08qm='SELECTED_ROUTE=LEGACY-A'; rejects(()=>a.validate(x.fields),'ROUTE_MISMATCH');
 x=good(); x.fields.flde4kea7ckvPVn2g='forged'; rejects(()=>a.validate(x.fields),'COMPLETION_FIELDS_NOT_EMPTY');
 x=good(); x.fields.fldyMDCSTEW46XKZV='other'; rejects(()=>a.validate(x.fields),'COMPLETION_FIELDS_NOT_EMPTY');
 x=good(); assert.equal(a.validate(x.fields),'APPLY');
 const dry=await a.run({fixture:x,dryRun:true}); assert.equal(dry.status,'DRY_RUN_ACCEPTED'); assert.equal(dry.patch.flde4kea7ckvPVn2g,C.result);
 x={fields:{...good().fields,...a.patch()}}; assert.equal(a.validate(x.fields),'REPLAY');
 x.fields.flde4kea7ckvPVn2g='conflict'; rejects(()=>a.validate(x.fields),'STATUS_MISMATCH');
 console.log('CYBERTRON_AIRTABLE_ACTUATOR_TEST PASS — 10 acceptance/rejection assertions');
})().catch(e=>{console.error(e);process.exit(1)});

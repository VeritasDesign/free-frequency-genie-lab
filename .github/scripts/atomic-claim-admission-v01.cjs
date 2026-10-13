'use strict';
// REVIEW ONLY. No Airtable, SQL, GitHub or executor calls. Database claimStore
// MUST implement unique-key atomic claiming; Airtable status is never a lock.
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
function fail(c){throw Error(c)}
function nonempty(x){return typeof x==='string'&&x.length>0&&x.trim()===x&&x.length<=256}
function checkReady(row,c){
 if(!row||!c)fail('ORDER_OR_CONTRACT_MISSING');
 for(const k of ['recordId','work_order_id','task_class','payload','next_action'])
  if(!own(c,k)||!nonempty(c[k])||row[k]!==c[k])fail('ORDER_IDENTITY_'+k.toUpperCase());
 if(row.status!=='READY')fail('ORDER_NOT_READY');
 for(const k of ['attempt_id','claimed_by','receipt','result'])
  if(row[k]!==undefined&&row[k]!==null&&row[k]!=='')fail('DIRTY_READY_'+k.toUpperCase());
 if(row.step!==0)fail('ORDER_STEP_NOT_INITIAL');
 if(!Number.isInteger(row.max_attempts)||row.max_attempts<1)fail('ATTEMPTS_INVALID');
 return true;
}
function checkLease(lease,c,attempt,owner){
 if(!lease||lease.work_order_id!==c.work_order_id||lease.attempt_id!==attempt||lease.owner!==owner||!Number.isSafeInteger(lease.fence)||lease.fence<1||lease.valid!==true)fail('OWNERSHIP_NOT_VERIFIED');
 return lease;
}
async function admit({row,contract,attemptId,owner,claimStore,readOrder,ttlSeconds=300}){
 checkReady(row,contract);
 if(!nonempty(attemptId)||!nonempty(owner))fail('CLAIM_IDENTITY_INVALID');
 if(!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>900)fail('CLAIM_TTL_INVALID');
 if(!claimStore||typeof claimStore.tryClaim!=='function'||typeof claimStore.readClaim!=='function'||typeof readOrder!=='function')fail('CLAIM_ADAPTER_MISSING');
 let proposed;
 try{proposed=await claimStore.tryClaim({work_order_id:contract.work_order_id,attempt_id:attemptId,owner,ttl_seconds:ttlSeconds})}
 catch(error){
  // A lost response is UNKNOWN unless exact durable ownership can be read back.
  try{proposed=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner)}
  catch{fail('CLAIM_RESULT_UNKNOWN')}
 }
 if(!proposed)fail('CLAIM_NOT_ACQUIRED');
 checkLease(proposed,contract,attemptId,owner);
 const durable=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner);
 if(durable.fence!==proposed.fence)fail('CLAIM_FENCE_CHANGED');
 checkReady(await readOrder(contract.recordId),contract);
 const final=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner);
 if(final.fence!==durable.fence)fail('CLAIM_FENCE_CHANGED');
 // Admission only: external effects require consumer-side fencing/idempotency.
 return Object.freeze({status:'ADMITTED_FOR_BOUNDED_WORK',work_order_id:contract.work_order_id,recordId:contract.recordId,attempt_id:attemptId,owner,fence:final.fence});
}
module.exports={admit,checkReady,checkLease};

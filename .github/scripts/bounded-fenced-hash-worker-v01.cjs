'use strict';
// REVIEW / ISOLATED ONLY. No Airtable mutation, deployment, network, arbitrary shell,
// GitHub PR or external effect. A SHA-256 receipt is the *only* bounded work.
// Admission is mandatory; the receipt adapter MUST atomically fence the DB write.
const crypto=require('node:crypto');
const {admit,checkReady}=require('./atomic-claim-admission-v01.cjs');
function fail(code){throw Error(code)}
const keys=['work_order_id','attempt_id','owner','fence','task_class','digest'];
function receiptFor(contract,admission){
 const canonical=JSON.stringify({
  version:'cybertron-bounded-hash-v01',
  recordId:contract.recordId,
  work_order_id:contract.work_order_id,
  task_class:contract.task_class,
  payload:contract.payload,
  next_action:contract.next_action
 });
 return Object.freeze({
  work_order_id:admission.work_order_id,attempt_id:admission.attempt_id,
  owner:admission.owner,fence:admission.fence,task_class:contract.task_class,
  digest:crypto.createHash('sha256').update(canonical,'utf8').digest('hex')
 });
}
function exactReceipt(found,expected){
 return !!found&&keys.every(k=>found[k]===expected[k])&&
  typeof found.digest==='string'&&/^[0-9a-f]{64}$/.test(found.digest);
}
async function runBoundedHash({row,contract,attemptId,owner,claimStore,readOrder,ttlSeconds=300}){
 // Exact allowlist. Do not claim an order we cannot execute.
 if(!contract||contract.task_class!=='harmless-hash')fail('TASK_CLASS_NOT_AUTHORIZED');
 if(!claimStore||typeof claimStore.commitReceipt!=='function'||typeof claimStore.readReceipt!=='function')fail('FENCED_RECEIPT_ADAPTER_REQUIRED');
 const admission=await admit({row,contract,attemptId,owner,claimStore,readOrder,ttlSeconds});
 // Airtable readback is a *check*, not a lock. The DB commit is the linearization point.
 checkReady(await readOrder(contract.recordId),contract);
 const receipt=receiptFor(contract,admission);
 let committed;
 try{
  committed=await claimStore.commitReceipt(receipt);
 }catch(error){
  // Lost response: do not retry a consequential operation. Read durable receipt.
  let recovered;
  try{recovered=await claimStore.readReceipt(admission.work_order_id)}
  catch{fail('RECEIPT_COMMIT_RESULT_UNKNOWN')}
  if(!exactReceipt(recovered,receipt))fail('RECEIPT_COMMIT_RESULT_UNKNOWN');
  return Object.freeze({status:'DURABLE_RECEIPT_RECONCILED',...receipt});
 }
 if(!exactReceipt(committed,receipt))fail('FENCED_RECEIPT_NOT_COMMITTED');
 let durable;
 try{durable=await claimStore.readReceipt(admission.work_order_id)}
 catch{fail('DURABLE_RECEIPT_READBACK_FAILED')}
 if(!exactReceipt(durable,receipt))fail('DURABLE_RECEIPT_MISMATCH');
 return Object.freeze({status:'DURABLE_BOUNDED_HASH_COMPLETE',...receipt});
}
module.exports={runBoundedHash,receiptFor,exactReceipt};

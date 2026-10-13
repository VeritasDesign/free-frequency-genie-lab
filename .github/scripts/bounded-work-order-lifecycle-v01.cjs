'use strict';
// REVIEW-ONLY Step 4. This composes existing atomic admission and bounded SHA-256
// worker with a durable work-order state machine. No live Airtable API or deploy.
// The injected orderStore MUST use DB-side CAS with exact claim/receipt checks.
const {admit,checkReady,checkLease}=require('./atomic-claim-admission-v01.cjs');
const {receiptFor,exactReceipt}=require('./bounded-fenced-hash-worker-v01.cjs');
const fail=c=>{throw Error(c)};
const nonempty=x=>typeof x==='string'&&x.length>0&&x.trim()===x&&x.length<=256;
function identity(row,c){
 if(!row||!c)fail('ORDER_MISSING');
 for(const k of ['recordId','work_order_id','task_class','payload','next_action'])
  if(!nonempty(c[k])||row[k]!==c[k])fail('ORDER_IDENTITY_'+k.toUpperCase());
 if(row.task_class!=='harmless-hash'||c.task_class!=='harmless-hash')fail('TASK_CLASS_NOT_AUTHORIZED');
 if(!Number.isSafeInteger(row.max_attempts)||row.max_attempts<1||row.max_attempts>2)fail('ATTEMPT_BUDGET_INVALID');
}
function claimed(row,c,attemptId,owner,fence){
 identity(row,c);
 if(row.status!=='CLAIMED'||row.step!==1||!Number.isSafeInteger(row.claim_generation)||row.claim_generation<1||row.claim_generation>row.max_attempts||row.attempt_id!==attemptId||row.claimed_by!==owner||
    !Number.isSafeInteger(row.fence)||row.fence<1||
    (fence!==undefined&&row.fence!==fence)||
    row.result!==null&&row.result!==''&&row.result!==undefined||
    row.receipt!==null&&row.receipt!==undefined)fail('CLAIMED_ORDER_NOT_EXACT');
 return row;
}
function completed(row,c,receipt){
 identity(row,c);
 if(row.status!=='COMPLETE'||row.step!==1||!Number.isSafeInteger(row.claim_generation)||row.claim_generation<1||row.claim_generation>row.max_attempts||
    row.attempt_id!==receipt.attempt_id||row.claimed_by!==receipt.owner||row.fence!==receipt.fence||
    row.result!==receipt.digest||!exactReceipt(row.receipt,receipt))fail('TERMINAL_ORDER_NOT_QUALIFIED');
 const expected=receiptFor(c,receipt);
 if(!exactReceipt(receipt,expected))fail('TERMINAL_DIGEST_OR_IDENTITY_MISMATCH');
 return row;
}
async function durableReceipt(claimStore,c){
 const receipt=await claimStore.readReceipt(c.work_order_id);
 if(!receipt)fail('DURABLE_RECEIPT_MISSING');
 if(!exactReceipt(receipt,receiptFor(c,receipt)))fail('DURABLE_RECEIPT_INVALID');
 return receipt;
}
async function runLifecycle({contract,attemptId,owner,claimStore,orderStore,hooks={}}){
 if(!contract||contract.task_class!=='harmless-hash')fail('TASK_CLASS_NOT_AUTHORIZED');
 if(!nonempty(attemptId)||!nonempty(owner))fail('ATTEMPT_OR_OWNER_INVALID');
 if(!claimStore||!orderStore||!['tryClaim','readClaim','commitReceipt','readReceipt'].every(k=>typeof claimStore[k]==='function')||
    !['readOrder','markClaimed','markComplete'].every(k=>typeof orderStore[k]==='function'))fail('LIFECYCLE_ADAPTER_REQUIRED');
 const read=()=>orderStore.readOrder(contract.recordId);
 let row=await read();identity(row,contract);
 if(row.status==='COMPLETE'){
  const receipt=await durableReceipt(claimStore,contract);
  completed(row,contract,receipt);
  return Object.freeze({status:'REPLAY_VERIFIED',...receipt});
 }
 if(row.status==='READY'){
  checkReady(row,contract);
  let admission;
  try{
   admission=await admit({row,contract,attemptId,owner,claimStore,readOrder:read});
  }catch(e){
   // Interruption after atomic claim but before status publication. Only exact
   // same live lease + unchanged READY may resume; no foreign claim takeover.
   if(e.message!=='CLAIM_NOT_ACQUIRED')throw e;
   const lease=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner);
   checkReady(await read(),contract);
   admission={work_order_id:contract.work_order_id,attempt_id:attemptId,owner,fence:lease.fence};
  }
  const claim={work_order_id:contract.work_order_id,attempt_id:attemptId,owner,fence:admission.fence};
  try{
   if(await orderStore.markClaimed(contract,claim)!==true)fail('CLAIM_PUBLICATION_REJECTED');
  }catch(e){
   // Lost ACK: read exact durable state, never blindly repeat a write.
   try{claimed(await read(),contract,attemptId,owner,claim.fence)}
   catch{fail('CLAIM_PUBLICATION_UNKNOWN')}
  }
  row=claimed(await read(),contract,attemptId,owner,claim.fence);
 }else if(row.status==='CLAIMED'){
  // Same-owner retries do not consume another attempt. A different attempt
  // can take over ONLY after lease expiry, if the bounded budget permits.
  if(row.attempt_id!==attemptId||row.claimed_by!==owner){
   if(row.attempt_id===attemptId)fail('ATTEMPT_ID_REUSED_BY_FOREIGN_OWNER');
   if(row.claim_generation>=row.max_attempts)fail('ATTEMPT_BUDGET_EXHAUSTED');
   if(typeof orderStore.transferClaim!=='function')fail('TAKEOVER_CAS_ADAPTER_REQUIRED');
   claimed(row,contract,row.attempt_id,row.claimed_by,row.fence);
   if(await claimStore.readReceipt(contract.work_order_id))fail('DURABLE_RECEIPT_PREVENTS_TAKEOVER');
   let lease;
   try{lease=await claimStore.tryClaim({
    work_order_id:contract.work_order_id,attempt_id:attemptId,owner,ttl_seconds:300
   })}
   catch{
    try{lease=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner)}
    catch{fail('TAKEOVER_CLAIM_RESULT_UNKNOWN')}
   }
   if(!lease){
    // The same new owner may be resuming after an interruption between
    // acquiring the lease and publishing the replacement claim.
    try{lease=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner)}
    catch{fail('TAKEOVER_CLAIM_NOT_ACQUIRED')}
   }
   checkLease(lease,contract,attemptId,owner);
   if(lease.fence<=row.fence)fail('TAKEOVER_FENCE_NOT_ADVANCED');
   const verified=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner);
   if(verified.fence!==lease.fence)fail('TAKEOVER_FENCE_CHANGED');
   const old={attempt_id:row.attempt_id,owner:row.claimed_by,fence:row.fence,claim_generation:row.claim_generation};
   const next={attempt_id:attemptId,owner,fence:lease.fence,work_order_id:contract.work_order_id};
   if(hooks.afterTakeoverLease)await hooks.afterTakeoverLease(); // isolated crash injection
   try{
    if(await orderStore.transferClaim(contract,old,next)!==true)fail('TAKEOVER_CAS_REJECTED');
   }catch{
    // A lost write ACK can be reconciled only by exact new-owner state.
    let observed;
    try{observed=claimed(await read(),contract,attemptId,owner,lease.fence)}
    catch{fail('TAKEOVER_PUBLICATION_UNKNOWN')}
    if(observed.claim_generation!==old.claim_generation+1)fail('TAKEOVER_PUBLICATION_UNKNOWN');
   }
   row=claimed(await read(),contract,attemptId,owner,lease.fence);
   if(row.claim_generation!==old.claim_generation+1)fail('TAKEOVER_GENERATION_MISMATCH');
  }else row=claimed(row,contract,attemptId,owner);
 }else fail('ORDER_STATUS_NOT_EXECUTABLE');
 if(hooks.afterClaimed)await hooks.afterClaimed(); // isolated crash injection only
 // Workflow Step is NOT an attempt counter. Require exact current work order
 // before hashing; database commit remains independently fenced.
 const fresh=claimed(await read(),contract,attemptId,owner,row.fence);
 if(fresh.claim_generation!==row.claim_generation)fail('CLAIM_GENERATION_CHANGED');
 let receipt=await claimStore.readReceipt(contract.work_order_id);
 if(receipt){
  if(!exactReceipt(receipt,receiptFor(contract,receipt))||
     receipt.attempt_id!==attemptId||receipt.owner!==owner||receipt.fence!==row.fence)
    fail('FOREIGN_OR_INVALID_DURABLE_RECEIPT');
 }else{
  const lease=checkLease(await claimStore.readClaim(contract.work_order_id),contract,attemptId,owner);
  if(lease.fence!==row.fence)fail('FENCE_CHANGED_BEFORE_EXECUTION');
  const proposed=receiptFor(contract,lease); // actual bounded SHA-256 worker
  let committed;
  try{committed=await claimStore.commitReceipt(proposed)}
  catch{
   try{committed=await durableReceipt(claimStore,contract)}
   catch{fail('RECEIPT_COMMIT_RESULT_UNKNOWN')}
  }
  if(!exactReceipt(committed,proposed))fail('FENCED_RECEIPT_NOT_COMMITTED');
  receipt=await durableReceipt(claimStore,contract);
  if(!exactReceipt(receipt,proposed))fail('DURABLE_RECEIPT_MISMATCH');
 }
 if(hooks.afterReceipt)await hooks.afterReceipt(); // isolated crash injection only
 try{
  if(await orderStore.markComplete(contract,receipt)!==true)fail('TERMINAL_CAS_REJECTED');
 }catch(e){
  try{completed(await read(),contract,receipt)}
  catch{fail('TERMINAL_COMMIT_RESULT_UNKNOWN')}
  return Object.freeze({status:'TERMINAL_ACK_RECONCILED',...receipt});
 }
 completed(await read(),contract,receipt);
 return Object.freeze({status:'COMPLETE_VERIFIED',...receipt});
}
module.exports={runLifecycle,identity,claimed,completed,durableReceipt};

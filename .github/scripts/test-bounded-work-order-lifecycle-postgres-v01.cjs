'use strict';
// End-to-end Step 4 in disposable GitHub Actions PostgreSQL ONLY.
// Real database writes are limited to cybertron_*_fixture tables.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {runLifecycle}=require('./bounded-work-order-lifecycle-v01.cjs');
const {receiptFor}=require('./bounded-fenced-hash-worker-v01.cjs');
const q=sql=>execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-F','|','-c',sql],{encoding:'utf8'}).trim();
const lit=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x))throw Error('TEST_IDENTITY_INVALID');return "'"+x+"'"};
const c=Object.freeze({recordId:'rec-CYB-LIFECYCLE',work_order_id:'CYB-LIFECYCLE-ISOLATED',task_class:'harmless-hash',payload:'MAN-HEART-ROBOT-KAW',next_action:'hash-only'});
const parseClaim=s=>{if(!s)return null;const [work_order_id,attempt_id,owner,fence,valid]=s.split('|');return {work_order_id,attempt_id,owner,fence:Number(fence),valid:valid==='t'}};
const parseReceipt=s=>{if(!s)return null;const [work_order_id,attempt_id,owner,fence,task_class,digest]=s.split('|');return {work_order_id,attempt_id,owner,fence:Number(fence),task_class,digest}};
const claimStore=()=>({
 async tryClaim({work_order_id,attempt_id,owner,ttl_seconds}){
  const ttl=Number(ttl_seconds);if(!Number.isSafeInteger(ttl)||ttl<30||ttl>900)throw Error('TTL_INVALID');
  return parseClaim(q(`INSERT INTO cybertron_claim_gate_fixture(work_order_id,attempt_id,owner,fence,expires_at)
  VALUES (${lit(work_order_id)},${lit(attempt_id)},${lit(owner)},1,clock_timestamp()+make_interval(secs=>${ttl}))
  ON CONFLICT (work_order_id) DO UPDATE SET
   attempt_id=EXCLUDED.attempt_id,owner=EXCLUDED.owner,fence=cybertron_claim_gate_fixture.fence+1,
   expires_at=EXCLUDED.expires_at,claimed_at=clock_timestamp()
  WHERE cybertron_claim_gate_fixture.completed_at IS NULL
    AND cybertron_claim_gate_fixture.expires_at<=clock_timestamp()
  RETURNING work_order_id,attempt_id,owner,fence,(expires_at>clock_timestamp() AND completed_at IS NULL);`));
 },
 async readClaim(id){return parseClaim(q(`SELECT work_order_id,attempt_id,owner,fence,
 (expires_at>clock_timestamp() AND completed_at IS NULL)
 FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(id)}`))},
 async commitReceipt(r){
  return parseReceipt(q(`WITH winner AS (
    UPDATE cybertron_claim_gate_fixture SET completed_at=clock_timestamp()
    WHERE work_order_id=${lit(r.work_order_id)} AND attempt_id=${lit(r.attempt_id)}
     AND owner=${lit(r.owner)} AND fence=${Number(r.fence)}
     AND expires_at>clock_timestamp() AND completed_at IS NULL
    RETURNING work_order_id,attempt_id,owner,fence
   )
   INSERT INTO cybertron_claim_receipt_fixture(work_order_id,attempt_id,owner,fence,task_class,digest)
   SELECT work_order_id,attempt_id,owner,fence,${lit(r.task_class)},${lit(r.digest)} FROM winner
   ON CONFLICT (work_order_id) DO NOTHING
   RETURNING work_order_id,attempt_id,owner,fence,task_class,digest;`));
 },
 async readReceipt(id){return parseReceipt(q(`SELECT work_order_id,attempt_id,owner,fence,task_class,digest
 FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(id)}`))}
});
const orderStore=()=>({
 async readOrder(id){
  const s=q(`SELECT json_build_object(
   'recordId',record_id,'work_order_id',work_order_id,'task_class',task_class,
   'payload',payload,'next_action',next_action,'status',status,'step',step,
   'max_attempts',max_attempts,'claim_generation',claim_generation,'attempt_id',attempt_id,'claimed_by',claimed_by,
   'fence',fence,'result',result,'receipt',receipt)::text
   FROM cybertron_work_order_fixture WHERE record_id=${lit(id)}`);
  return s?JSON.parse(s):null;
 },
 async markClaimed(contract,claim){
  const s=q(`WITH owner_gate AS (
   SELECT work_order_id FROM cybertron_claim_gate_fixture
   WHERE work_order_id=${lit(claim.work_order_id)}
    AND attempt_id=${lit(claim.attempt_id)} AND owner=${lit(claim.owner)}
    AND fence=${Number(claim.fence)} AND expires_at>clock_timestamp()
    AND completed_at IS NULL FOR UPDATE
  )
  UPDATE cybertron_work_order_fixture AS w
  SET status='CLAIMED',step=1,claim_generation=1,attempt_id=${lit(claim.attempt_id)},
      claimed_by=${lit(claim.owner)},fence=${Number(claim.fence)}
  WHERE w.record_id=${lit(contract.recordId)}
    AND w.work_order_id=${lit(contract.work_order_id)}
    AND w.task_class=${lit(contract.task_class)} AND w.payload=${lit(contract.payload)}
    AND w.next_action=${lit(contract.next_action)}
    AND w.status='READY' AND w.step=0 AND w.max_attempts BETWEEN 1 AND 2
    AND EXISTS(SELECT 1 FROM owner_gate)
  RETURNING record_id;`);
  return s===contract.recordId;
 },
 async transferClaim(contract,old,next){
  // The claim-row lock and exact CAS serialize with any concurrent receipt
  // commit. An expired old worker cannot commit after this new fence wins.
  const s=q(`WITH owner_gate AS (
   SELECT work_order_id FROM cybertron_claim_gate_fixture
   WHERE work_order_id=${lit(next.work_order_id)}
    AND attempt_id=${lit(next.attempt_id)} AND owner=${lit(next.owner)}
    AND fence=${Number(next.fence)} AND expires_at>clock_timestamp()
    AND completed_at IS NULL FOR UPDATE
  )
  UPDATE cybertron_work_order_fixture AS w
  SET attempt_id=${lit(next.attempt_id)},claimed_by=${lit(next.owner)},
      fence=${Number(next.fence)},claim_generation=w.claim_generation+1
  WHERE w.record_id=${lit(contract.recordId)}
    AND w.work_order_id=${lit(contract.work_order_id)}
    AND w.task_class=${lit(contract.task_class)} AND w.payload=${lit(contract.payload)}
    AND w.next_action=${lit(contract.next_action)}
    AND w.status='CLAIMED' AND w.step=1 AND w.claim_generation=${Number(old.claim_generation)}
    AND w.max_attempts>=w.claim_generation+1
    AND w.attempt_id=${lit(old.attempt_id)} AND w.claimed_by=${lit(old.owner)}
    AND w.fence=${Number(old.fence)} AND w.result IS NULL AND w.receipt IS NULL
    AND NOT EXISTS(SELECT 1 FROM cybertron_claim_receipt_fixture r
      WHERE r.work_order_id=w.work_order_id)
    AND EXISTS(SELECT 1 FROM owner_gate)
  RETURNING record_id;`);
  return s===contract.recordId;
 },
 async markComplete(contract,r){
  const s=q(`WITH receipt_gate AS (
   SELECT r.work_order_id FROM cybertron_claim_receipt_fixture r
   JOIN cybertron_claim_gate_fixture g ON g.work_order_id=r.work_order_id
   WHERE r.work_order_id=${lit(r.work_order_id)} AND r.attempt_id=${lit(r.attempt_id)}
     AND r.owner=${lit(r.owner)} AND r.fence=${Number(r.fence)}
     AND r.task_class=${lit(r.task_class)} AND r.digest=${lit(r.digest)}
     AND g.attempt_id=r.attempt_id AND g.owner=r.owner AND g.fence=r.fence
     AND g.completed_at IS NOT NULL
  )
  UPDATE cybertron_work_order_fixture AS w SET
   status='COMPLETE',result=${lit(r.digest)},
   receipt=jsonb_build_object('work_order_id',${lit(r.work_order_id)},
    'attempt_id',${lit(r.attempt_id)},'owner',${lit(r.owner)},
    'fence',${Number(r.fence)},'task_class',${lit(r.task_class)},
    'digest',${lit(r.digest)})
  WHERE w.record_id=${lit(contract.recordId)} AND w.work_order_id=${lit(contract.work_order_id)}
   AND w.task_class=${lit(contract.task_class)} AND w.payload=${lit(contract.payload)}
   AND w.next_action=${lit(contract.next_action)}
   AND w.status='CLAIMED' AND w.step=1 AND w.claim_generation BETWEEN 1 AND w.max_attempts AND w.attempt_id=${lit(r.attempt_id)}
   AND w.claimed_by=${lit(r.owner)} AND w.fence=${Number(r.fence)}
   AND w.result IS NULL AND w.receipt IS NULL AND EXISTS(SELECT 1 FROM receipt_gate)
  RETURNING record_id;`);
  return s===contract.recordId;
 }
});
function args(attemptId='ATTEMPT-A',owner='RUNNER-A',override={}){return {contract:c,attemptId,owner,claimStore:claimStore(),orderStore:orderStore(),...override}}
function reset(maxAttempts=1){
 q(`DELETE FROM cybertron_work_order_events_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 q(`DELETE FROM cybertron_work_order_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 q(`DELETE FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 q(`DELETE FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 q(`INSERT INTO cybertron_work_order_fixture(record_id,work_order_id,task_class,payload,next_action,status,step,max_attempts)
 VALUES(${lit(c.recordId)},${lit(c.work_order_id)},${lit(c.task_class)},${lit(c.payload)},${lit(c.next_action)},'READY',0,${Number(maxAttempts)})`);
}
function statuses(){return q(`SELECT string_agg(status,'>' ORDER BY seq) FROM cybertron_work_order_events_fixture
 WHERE work_order_id=${lit(c.work_order_id)}`)}
function count(table){if(!['cybertron_claim_receipt_fixture','cybertron_claim_gate_fixture'].includes(table))throw Error('BAD_TABLE');
 return Number(q(`SELECT count(*) FROM ${table} WHERE work_order_id=${lit(c.work_order_id)}`))}
function state(){return q(`SELECT status FROM cybertron_work_order_fixture WHERE work_order_id=${lit(c.work_order_id)}`)}
async function check(label,fn){try{await fn();console.log('CYBERTRON_LIFECYCLE_'+label+'_PASS')}catch(e){console.error('CYBERTRON_LIFECYCLE_'+label+'_FAIL',e);throw e}}
(async()=>{
 await check('COMPLETE',async()=>{
  reset();const result=await runLifecycle(args());
  assert.equal(result.status,'COMPLETE_VERIFIED');
  assert.equal(result.digest,receiptFor(c,result).digest);
  assert.equal(statuses(),'READY>CLAIMED>COMPLETE');assert.equal(state(),'COMPLETE');
  assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('REPLAY',async()=>{
  const before=statuses();
  const a=await runLifecycle(args());const b=await runLifecycle(args('ATTEMPT-FOREIGN','RUNNER-FOREIGN'));
  assert.equal(a.status,'REPLAY_VERIFIED');assert.equal(b.status,'REPLAY_VERIFIED');
  assert.equal(statuses(),before);assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('CRASH_AFTER_CLAIMED',async()=>{
  reset();await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterClaimed:()=>{throw Error('SIMULATED_PROCESS_EXIT')}}})),/SIMULATED_PROCESS_EXIT/);
  assert.equal(state(),'CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
  const result=await runLifecycle(args());assert.equal(result.status,'COMPLETE_VERIFIED');
  assert.equal(statuses(),'READY>CLAIMED>COMPLETE');
 });
 await check('CRASH_AFTER_RECEIPT',async()=>{
  reset();await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterReceipt:()=>{throw Error('SIMULATED_PROCESS_EXIT')}}})),/SIMULATED_PROCESS_EXIT/);
  assert.equal(state(),'CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),1);
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  const result=await runLifecycle(args());assert.equal(result.status,'COMPLETE_VERIFIED');
  assert.equal(statuses(),'READY>CLAIMED>COMPLETE');assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('CRASH_BEFORE_CLAIM_PUBLICATION',async()=>{
  reset();const os=orderStore();os.markClaimed=async()=>{throw Error('SIMULATED_PROCESS_EXIT_BEFORE_WRITE')};
  await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{orderStore:os})),/CLAIM_PUBLICATION_UNKNOWN/);
  assert.equal(state(),'READY');assert.equal(count('cybertron_claim_gate_fixture'),1);
  const result=await runLifecycle(args());assert.equal(result.status,'COMPLETE_VERIFIED');
  assert.equal(statuses(),'READY>CLAIMED>COMPLETE');
 });
 await check('LOST_CLAIM_ACK',async()=>{
  reset();const os=orderStore(),original=os.markClaimed;
  os.markClaimed=async(...params)=>{assert.equal(await original(...params),true);throw Error('LOST_CLAIM_ACK')};
  const result=await runLifecycle(args('ATTEMPT-A','RUNNER-A',{orderStore:os}));
  assert.equal(result.status,'COMPLETE_VERIFIED');assert.equal(statuses(),'READY>CLAIMED>COMPLETE');
 });
 await check('LOST_RECEIPT_ACK',async()=>{
  reset();const cs=claimStore(),original=cs.commitReceipt;
  cs.commitReceipt=async r=>{await original(r);throw Error('LOST_RECEIPT_ACK')};
  const result=await runLifecycle(args('ATTEMPT-A','RUNNER-A',{claimStore:cs}));
  assert.equal(result.status,'COMPLETE_VERIFIED');assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('LOST_COMPLETE_ACK',async()=>{
  reset();const os=orderStore(),original=os.markComplete;
  os.markComplete=async(...params)=>{assert.equal(await original(...params),true);throw Error('LOST_COMPLETE_ACK')};
  const result=await runLifecycle(args('ATTEMPT-A','RUNNER-A',{orderStore:os}));
  assert.equal(result.status,'TERMINAL_ACK_RECONCILED');
  assert.equal(statuses(),'READY>CLAIMED>COMPLETE');
 });
 await check('EXPIRED_CLAIM_NO_RECEIPT',async()=>{
  reset();await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterClaimed:()=>{
   q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  }}})),/OWNERSHIP_NOT_VERIFIED/);
  assert.equal(state(),'CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
  await assert.rejects(runLifecycle(args()),/OWNERSHIP_NOT_VERIFIED/);
 });
 await check('FENCE_TAKEOVER_REJECTS_STALE',async()=>{
  reset();await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterClaimed:async()=>{
   q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
   const winner=await claimStore().tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-B',owner:'RUNNER-B',ttl_seconds:300});
   assert.equal(winner.fence,2);
  }}})),/OWNERSHIP_NOT_VERIFIED/);
  assert.equal(state(),'CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
  await assert.rejects(runLifecycle(args('ATTEMPT-B','RUNNER-B')),/ATTEMPT_BUDGET_EXHAUSTED/);
 });
 await check('FOREIGN_CLAIM_REJECTED',async()=>{
  reset();await claimStore().tryClaim({work_order_id:c.work_order_id,attempt_id:'FOREIGN',owner:'FOREIGN',ttl_seconds:300});
  await assert.rejects(runLifecycle(args()),/OWNERSHIP_NOT_VERIFIED/);
  assert.equal(state(),'READY');assert.equal(count('cybertron_claim_receipt_fixture'),0);
 });
 await check('TAMPERED_TERMINAL_REFUSED',async()=>{
  reset();await runLifecycle(args());
  q(`UPDATE cybertron_work_order_fixture SET result=repeat('0',64) WHERE work_order_id=${lit(c.work_order_id)}`);
  await assert.rejects(runLifecycle(args()),/TERMINAL_ORDER_NOT_QUALIFIED/);
  assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('NO_RECEIPT_NO_COMPLETION',async()=>{
  reset();const os=orderStore(),cs=claimStore();
  const claim=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,claim),true);
  const forged=receiptFor(c,claim);
  assert.equal(await os.markComplete(c,forged),false);
  assert.equal(state(),'CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
 });
 await check('TAKEOVER_EXPIRED_NO_RECEIPT',async()=>{
  reset(2);
  await assert.rejects(runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterClaimed:()=>{
   q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
   throw Error('SIMULATED_WORKER_A_EXIT');
  }}})),/SIMULATED_WORKER_A_EXIT/);
  const next=await runLifecycle(args('ATTEMPT-B','RUNNER-B'));
  assert.equal(next.status,'COMPLETE_VERIFIED');assert.equal(next.fence,2);
  assert.equal(statuses(),'READY>CLAIMED>CLAIMED>COMPLETE');
  assert.equal(q(`SELECT step FROM cybertron_work_order_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'1');
  assert.equal(q(`SELECT claim_generation FROM cybertron_work_order_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'2');
  assert.equal(count('cybertron_claim_receipt_fixture'),1);
  const replay=await runLifecycle(args('ATTEMPT-A','RUNNER-A',{hooks:{afterClaimed:()=>{throw Error('REPLAY_TRIGGERED_HOOK')}}}));assert.equal(replay.status,'REPLAY_VERIFIED');
 });
 await check('TAKEOVER_OLD_OWNER_CANNOT_COMMIT',async()=>{
  reset(2);const cs=claimStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await orderStore().markClaimed(c,a),true);
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  const b=await runLifecycle(args('ATTEMPT-B','RUNNER-B',{hooks:{afterClaimed:()=>{throw Error('STOP_BEFORE_B_RECEIPT')}}})).catch(e=>{assert.match(e.message,/STOP_BEFORE_B_RECEIPT/);return null});
  assert.equal(b,null);
  assert.equal(await cs.commitReceipt(receiptFor(c,a)),null);
  assert.equal(count('cybertron_claim_receipt_fixture'),0);
  const done=await runLifecycle(args('ATTEMPT-B','RUNNER-B'));assert.equal(done.status,'COMPLETE_VERIFIED');
  assert.equal(count('cybertron_claim_receipt_fixture'),1);
 });
 await check('TAKEOVER_CRASH_AFTER_NEW_LEASE',async()=>{
  reset(2);const cs=claimStore(),os=orderStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,a),true);
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  await assert.rejects(runLifecycle(args('ATTEMPT-B','RUNNER-B',{hooks:{afterTakeoverLease:()=>{throw Error('SIMULATED_TAKEOVER_EXIT')}}})),/SIMULATED_TAKEOVER_EXIT/);
  assert.equal(statuses(),'READY>CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
  const done=await runLifecycle(args('ATTEMPT-B','RUNNER-B'));
  assert.equal(done.status,'COMPLETE_VERIFIED');assert.equal(statuses(),'READY>CLAIMED>CLAIMED>COMPLETE');
 });
 await check('TAKEOVER_LOST_PUBLICATION_ACK',async()=>{
  reset(2);const cs=claimStore(),os=orderStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,a),true);
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  const original=os.transferClaim;os.transferClaim=async(...p)=>{assert.equal(await original(...p),true);throw Error('SIMULATED_LOST_TAKEOVER_ACK')};
  const done=await runLifecycle(args('ATTEMPT-B','RUNNER-B',{orderStore:os}));
  assert.equal(done.status,'COMPLETE_VERIFIED');assert.equal(statuses(),'READY>CLAIMED>CLAIMED>COMPLETE');
 });
 await check('TAKEOVER_LIVE_LEASE_REFUSED',async()=>{
  reset(2);const cs=claimStore(),os=orderStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,a),true);
  await assert.rejects(runLifecycle(args('ATTEMPT-B','RUNNER-B')),/TAKEOVER_CLAIM_NOT_ACQUIRED/);
  assert.equal(statuses(),'READY>CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
 });
 await check('TAKEOVER_ATTEMPT_BUDGET_REFUSED',async()=>{
  reset(1);const cs=claimStore(),os=orderStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,a),true);
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  await assert.rejects(runLifecycle(args('ATTEMPT-B','RUNNER-B')),/ATTEMPT_BUDGET_EXHAUSTED/);
  assert.equal(statuses(),'READY>CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),0);
 });
 await check('TAKEOVER_AFTER_DURABLE_RECEIPT_REFUSED',async()=>{
  reset(2);const cs=claimStore(),os=orderStore();
  const a=await cs.tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-A',owner:'RUNNER-A',ttl_seconds:300});
  assert.equal(await os.markClaimed(c,a),true);
  assert.ok(await cs.commitReceipt(receiptFor(c,a)));
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  await assert.rejects(runLifecycle(args('ATTEMPT-B','RUNNER-B')),/DURABLE_RECEIPT_PREVENTS_TAKEOVER/);
  assert.equal(statuses(),'READY>CLAIMED');assert.equal(count('cybertron_claim_receipt_fixture'),1);
  const done=await runLifecycle(args('ATTEMPT-A','RUNNER-A'));assert.equal(done.status,'COMPLETE_VERIFIED');
 });
 console.log('CYBERTRON_LIFECYCLE_DISPOSABLE_POSTGRES_PASS 20 scenarios; real READY>CLAIMED>COMPLETE and bounded takeover; zero Airtable/Neon/production writes');
})().catch(e=>{console.error(e);process.exitCode=1});

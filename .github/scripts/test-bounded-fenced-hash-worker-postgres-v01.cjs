'use strict';
// Real disposable PostgreSQL integration; isolated GitHub Actions service ONLY.
// This is not the production database adapter or an Airtable mutation.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {runBoundedHash}=require('./bounded-fenced-hash-worker-v01.cjs');
const q=sql=>execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-F','|','-c',sql],{encoding:'utf8'}).trim();
function lit(x){if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x))throw Error('FIXTURE_SQL_IDENTITY_INVALID');return "'"+x+"'"}
const c=Object.freeze({recordId:'rec-ISOLATED-WORKER',work_order_id:'CYB-FENCED-HASH-001',task_class:'harmless-hash',payload:'MAN-HEART-ROBOT-KAW',next_action:'hash-only'});
const row=()=>({...c,status:'READY',step:0,max_attempts:1});
function parseClaim(s){if(!s)return null;const [work_order_id,attempt_id,owner,fence,valid]=s.split('|');return {work_order_id,attempt_id,owner,fence:Number(fence),valid:valid==='t'}}
function parseReceipt(s){if(!s)return null;const [work_order_id,attempt_id,owner,fence,task_class,digest]=s.split('|');return {work_order_id,attempt_id,owner,fence:Number(fence),task_class,digest}}
function store(){return {
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
  // One atomic SQL statement. UPDATE locks the claim row. Receipt is inserted
  // only from a successful matching fence, and completion prevents takeover.
  return parseReceipt(q(`WITH winner AS (
   UPDATE cybertron_claim_gate_fixture
   SET completed_at=clock_timestamp()
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
}}
function args(attemptId,owner,overrides={}){return {row:row(),contract:c,attemptId,owner,claimStore:store(),readOrder:async()=>row(),...overrides}}
function reset(){q(`DELETE FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`);q(`DELETE FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(c.work_order_id)}`)}
(async()=>{
 reset();
 const winner=await runBoundedHash(args('ATTEMPT-A','RUNNER-A'));
 assert.equal(winner.status,'DURABLE_BOUNDED_HASH_COMPLETE');assert.match(winner.digest,/^[0-9a-f]{64}$/);
 assert.equal(q(`SELECT count(*) FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'1');
 console.log('CYBERTRON_FENCED_EXECUTOR_PG_PASS admission -> fenced commit -> SHA256 durable receipt');
 await assert.rejects(runBoundedHash(args('ATTEMPT-A','RUNNER-A')),/CLAIM_NOT_ACQUIRED/);
 await assert.rejects(runBoundedHash(args('ATTEMPT-B','RUNNER-B')),/CLAIM_NOT_ACQUIRED/);
 q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
 await assert.rejects(runBoundedHash(args('ATTEMPT-B','RUNNER-B')),/CLAIM_NOT_ACQUIRED/);
 assert.equal(q(`SELECT count(*) FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'1');
 console.log('CYBERTRON_FENCED_EXECUTOR_REPLAY_PG_PASS duplicate and expired-lease takeover refused after completion');
 reset();
 let reads=0;const changed=args('ATTEMPT-A','RUNNER-A',{readOrder:async()=>{reads++;if(reads===2){
  q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
  const successor=await store().tryClaim({work_order_id:c.work_order_id,attempt_id:'ATTEMPT-B',owner:'RUNNER-B',ttl_seconds:300});
  assert.equal(successor.fence,2);
 }return row()}});
 await assert.rejects(runBoundedHash(changed),/FENCED_RECEIPT_NOT_COMMITTED/);
 assert.equal(q(`SELECT count(*) FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'0');
 const successor=await store().readClaim(c.work_order_id);assert.equal(successor.owner,'RUNNER-B');assert.equal(successor.fence,2);
 console.log('CYBERTRON_FENCED_EXECUTOR_TAKEOVER_PG_PASS old worker blocked after new fence wins');
 reset();
 const db=store();const lost={...db,commitReceipt:async r=>{await db.commitReceipt(r);throw Error('simulated network reset after commit')}};
 const recovered=await runBoundedHash(args('ATTEMPT-LOST','RUNNER-LOST',{claimStore:lost}));
 assert.equal(recovered.status,'DURABLE_RECEIPT_RECONCILED');
 assert.equal(q(`SELECT count(*) FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'1');
 console.log('CYBERTRON_FENCED_EXECUTOR_LOST_ACK_PG_PASS exact durable receipt readback, no second effect');
 reset();
 let orderReads=0;await assert.rejects(runBoundedHash(args('ATTEMPT-C','RUNNER-C',{readOrder:async()=>++orderReads===1?row():{...row(),status:'BLOCKED'}})),/ORDER_NOT_READY/);
 assert.equal(q(`SELECT count(*) FROM cybertron_claim_receipt_fixture WHERE work_order_id=${lit(c.work_order_id)}`),'0');
 console.log('CYBERTRON_FENCED_EXECUTOR_ORDER_DRIFT_PG_PASS no receipt after status changes');
 console.log('CYBERTRON_FENCED_EXECUTOR_DISPOSABLE_PG_PASS no Airtable writes, production DB or deployment');
})().catch(e=>{console.error(e);process.exitCode=1});

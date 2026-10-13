'use strict';
// Disposable GitHub Actions Postgres only. Test adapter, NOT a production DB client.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {admit}=require('./atomic-claim-admission-v01.cjs');
function q(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-F','|','-c',sql],{encoding:'utf8'}).trim()}
function lit(x){if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x))throw Error('TEST_SQL_IDENTITY_INVALID');return "'"+x+"'"}
function parse(row){if(!row)return null;const [work_order_id,attempt_id,owner,fence,valid]=row.split('|');return {work_order_id,attempt_id,owner,fence:Number(fence),valid:valid==='t'}}
function store(){return {
 tryClaim:async({work_order_id,attempt_id,owner,ttl_seconds})=>parse(q(`INSERT INTO cybertron_claim_gate_fixture(work_order_id,attempt_id,owner,fence,expires_at)
 VALUES (${lit(work_order_id)},${lit(attempt_id)},${lit(owner)},1,clock_timestamp() + interval '${Number(ttl_seconds)} seconds')
 ON CONFLICT (work_order_id) DO UPDATE
 SET attempt_id=EXCLUDED.attempt_id,owner=EXCLUDED.owner,fence=cybertron_claim_gate_fixture.fence+1,
 expires_at=EXCLUDED.expires_at,claimed_at=clock_timestamp()
 WHERE cybertron_claim_gate_fixture.expires_at <= clock_timestamp()
 RETURNING work_order_id,attempt_id,owner,fence,(expires_at>clock_timestamp());`)),
 readClaim:async(id)=>parse(q(`SELECT work_order_id,attempt_id,owner,fence,(expires_at>clock_timestamp()) FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(id)}`))
}}
const c={recordId:'rec-ISOLATED-PG',work_order_id:'CYB-ADMISSION-PG-001',task_class:'harmless-hash',payload:'KAW',next_action:'hash-only'};
const row=()=>({...c,status:'READY',step:0,max_attempts:1});
const args=(attemptId,owner)=>({row:row(),contract:c,attemptId,owner,claimStore:store(),readOrder:async()=>row()});
(async()=>{
 q(`DELETE FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 const a=await admit(args('ATTEMPT-A','RUNNER-A'));assert.equal(a.fence,1);
 await assert.rejects(admit(args('ATTEMPT-B','RUNNER-B')),/CLAIM_NOT_ACQUIRED/);
 await assert.rejects(admit(args('ATTEMPT-A','RUNNER-A')),/CLAIM_NOT_ACQUIRED/);
 console.log('CYBERTRON_ADMISSION_PG_EXCLUSIVE_PASS one claim, no second admission or silent renewal');
 q(`UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id=${lit(c.work_order_id)}`);
 const b=await admit(args('ATTEMPT-B','RUNNER-B'));assert.equal(b.fence,2);
 await assert.rejects(admit(args('ATTEMPT-A','RUNNER-A')),/CLAIM_NOT_ACQUIRED/);
 console.log('CYBERTRON_ADMISSION_PG_FENCE_PASS takeover fence=2, prior owner refused');
 q(`DELETE FROM cybertron_claim_gate_fixture WHERE work_order_id=${lit(c.work_order_id)}`);
 const db=store();const lost={tryClaim:async(x)=>{await db.tryClaim(x);throw Error('simulated lost response')},readClaim:db.readClaim};
 const recovered=await admit({...args('ATTEMPT-LOST','RUNNER-LOST'),claimStore:lost});assert.equal(recovered.fence,1);
 console.log('CYBERTRON_ADMISSION_PG_LOST_RESPONSE_PASS exact durable readback recovers ownership');
 await assert.rejects(admit({...args('ATTEMPT-OTHER','RUNNER-OTHER'),readOrder:async()=>({...row(),status:'COMPLETE'})}),/CLAIM_NOT_ACQUIRED/);
 console.log('CYBERTRON_ADMISSION_PG_TERMINAL_GUARD_PASS no new claimant after completion metadata drift');
 console.log('CYBERTRON_ADMISSION_PG_DISPOSABLE_PASS no Airtable writes, no executor, no production database');
})().catch(e=>{console.error(e);process.exitCode=1});

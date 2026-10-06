import assert from "node:assert/strict";
import {validateWorkOrder,completeReceipt,verify,applyAcceptance} from "./contracts.mjs";
const work={task_id:"ROCK-001",execution_id:"ROCK-001-0001",task_class:"synthetic",objective:"prove verifier boundary",scope:{synthetic:true},acceptance_contract:{required_evidence:["artifact","test"]},production_authority:false,unlocks:["ROCK-002"]};
assert.equal(validateWorkOrder(work),true);

// Baseline incomplete evidence must fail closed.
const bad=completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"}]);
const rejected=verify(work,bad); assert.equal(rejected.status,"INSUFFICIENT_EVIDENCE");
let state={tasks:{"ROCK-001":"VERIFYING","ROCK-002":"BACKLOG"},executions:{}};
let a=applyAcceptance(state,work,rejected); assert.equal(a.state.tasks["ROCK-002"],"BACKLOG");

// Boundary attacks.
assert.equal(verify(work,{...completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"},{kind:"test",id:"T1"}]),task_id:"FORGED"}).status,"INSUFFICIENT_EVIDENCE");
assert.equal(verify(work,{...completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"},{kind:"test",id:"T1"}]),execution_id:"FORGED-EXEC"}).status,"INSUFFICIENT_EVIDENCE");
assert.equal(verify(work,{...completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"},{kind:"test",id:"T1"}]),result:"ACCEPTED"}).status,"REJECTED");
assert.equal(verify(work,{...completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"},{kind:"test",id:"T1"}]),production_modified:true}).status,"REJECTED");
const garbage=completeReceipt(work,"synthetic-worker",[{kind:"artifact"},{kind:"test"}]);
assert.equal(verify(work,garbage).status,"INSUFFICIENT_EVIDENCE");

// Valid evidence accepts and only then unlocks.
const good=completeReceipt(work,"synthetic-worker",[{kind:"artifact",id:"A1"},{kind:"test",id:"T1"}]);
const accepted=verify(work,good); assert.equal(accepted.status,"ACCEPTED");
a=applyAcceptance(state,work,accepted); assert.equal(a.state.tasks["ROCK-001"],"ACCEPTED"); assert.equal(a.state.tasks["ROCK-002"],"ELIGIBLE");
const replay=applyAcceptance(a.state,work,accepted); assert.equal(replay.duplicate,true); assert.deepEqual(replay.state,a.state);
assert.throws(()=>validateWorkOrder({...work,production_authority:true}),/PRODUCTION_AUTHORITY_FORBIDDEN/);
console.log("CYBERTRON_ROCK_V01 ADVERSARIAL PASS — identity, authority, evidence, acceptance, idempotency");

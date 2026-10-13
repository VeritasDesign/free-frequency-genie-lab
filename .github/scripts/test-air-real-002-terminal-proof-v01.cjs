'use strict';
const assert=require('node:assert/strict');
const {C}=require('./cybertron-airtable-ready-dispatcher-v02.cjs');
const {P,verify}=require('./air-real-002-terminal-proof-v01.cjs');
const F=C.fields;
const f=()=>({[F.id]:C.id,[F.task]:C.task,[F.payload]:C.payload,[F.status]:'COMPLETE',[F.attempt]:C.exec,[F.claimed]:'Cybertron READY Dispatcher v0.2',[F.result]:P.result,[F.receipt]:P.receipt,[F.next]:P.next});
const e=()=>({pr:{number:2,html_url:P.prUrl,state:'closed',merged:true,merged_at:'2026-10-07T19:22:23Z',head:{sha:P.head,repo:{full_name:C.target.repo}},base:{ref:'main',repo:{full_name:C.target.repo}},merge_commit_sha:P.merge},commit:{sha:P.head,files:[{filename:C.target.path,status:'modified'}]},compare:{status:'ahead',behind_by:0,ahead_by:1,base_commit:{sha:P.head}}});
let count=0;
function pass(fields,evidence){assert.equal(verify(fields,evidence),'HISTORIC_COMPLETE_VERIFIED');count++}
function reject(fields,evidence,code){assert.throws(()=>verify(fields,evidence),x=>x.message===code);count++}
pass(f(),e());
for(const [key,code] of Object.entries({id:'TERMINAL_ID_MISMATCH',task:'TERMINAL_TASK_MISMATCH',payload:'TERMINAL_PAYLOAD_MISMATCH',status:'TERMINAL_STATUS_MISMATCH',attempt:'TERMINAL_ATTEMPT_MISMATCH',claimed:'TERMINAL_CLAIMED_MISMATCH',result:'TERMINAL_RESULT_MISMATCH',receipt:'TERMINAL_RECEIPT_MISMATCH',next:'TERMINAL_NEXT_MISMATCH'})){
  const v=f();v[F[key]]='substituted';reject(v,e(),code);
}
for(const [name,mutate,code] of [
 ['PR unmerged',x=>x.pr.merged=false,'TERMINAL_PR_EVIDENCE_MISMATCH'],
 ['PR head substituted',x=>x.pr.head.sha='other','TERMINAL_PR_EVIDENCE_MISMATCH'],
 ['PR merge substituted',x=>x.pr.merge_commit_sha='other','TERMINAL_PR_EVIDENCE_MISMATCH'],
 ['PR base substituted',x=>x.pr.base.ref='other','TERMINAL_PR_EVIDENCE_MISMATCH'],
 ['PR URL substituted',x=>x.pr.html_url='other','TERMINAL_PR_EVIDENCE_MISMATCH'],
 ['commit substituted',x=>x.commit.sha='other','TERMINAL_COMMIT_EVIDENCE_MISMATCH'],
 ['commit file substituted',x=>x.commit.files[0].filename='other','TERMINAL_COMMIT_EVIDENCE_MISMATCH'],
 ['extra commit file',x=>x.commit.files.push({filename:'other'}),'TERMINAL_COMMIT_EVIDENCE_MISMATCH'],
 ['missing ancestry',x=>x.compare.behind_by=1,'TERMINAL_ANCESTRY_UNVERIFIED'],
 ['missing base sha',x=>x.compare.base_commit.sha='other','TERMINAL_ANCESTRY_UNVERIFIED'],
 ['compare diverged',x=>x.compare.status='diverged','TERMINAL_ANCESTRY_UNVERIFIED']
]){const v=e();mutate(v);reject(f(),v,code)}
pass(f(),{...e(),compare:{...e().compare,status:'identical',ahead_by:0}});
console.log('AIR_REAL_002_HISTORIC_TERMINAL_GATE_PASS '+count+' isolated cases; zero external requests/writes');

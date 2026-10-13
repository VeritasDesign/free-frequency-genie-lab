'use strict';
// Historical, exact-target, READ-ONLY terminal evidence gate for AIR-REAL-002.
// Not a generic dispatcher replay contract. No write, claim, or production deploy.
const {C,req}=require('./cybertron-airtable-ready-dispatcher-v02.cjs');
const P={
  prUrl:'https://github.com/VeritasDesign/free-frequency-landing-lab/pull/2',
  head:'68fbb49bc345e5ac7bb20c4254720866e5b7b010',
  merge:'3f546510b5a5deb5eaa46cfdc4d97c8e83e7661c',
  result:'AIR-REAL-002 desktop hero patch built and verified; https://github.com/VeritasDesign/free-frequency-landing-lab/pull/2',
  receipt:'FACTORY RECEIPT: bounded desktop-only hero CSS patch; existing mobile correction preserved in source/build verification; PR evidence=https://github.com/VeritasDesign/free-frequency-landing-lab/pull/2; NO PRODUCTION DEPLOY.',
  next:'Human visual review of desktop + mobile PR evidence; merge/deployment remains separately gated.'
};
function verify(fields,evidence){
  const x=k=>fields[C.fields[k]]??'';
  for(const [key,expected] of Object.entries({id:C.id,task:C.task,payload:C.payload,status:'COMPLETE',attempt:C.exec,claimed:'Cybertron READY Dispatcher v0.2',result:P.result,receipt:P.receipt,next:P.next})){
    if(x(key)!==expected)throw Error('TERMINAL_'+key.toUpperCase()+'_MISMATCH');
  }
  const {pr,commit,compare}=evidence||{};
  if(!pr||pr.number!==2||pr.html_url!==P.prUrl||pr.state!=='closed'||!pr.merged||!pr.merged_at||pr.head?.sha!==P.head||pr.base?.ref!=='main'||pr.base?.repo?.full_name!==C.target.repo||pr.head?.repo?.full_name!==C.target.repo||pr.merge_commit_sha!==P.merge)throw Error('TERMINAL_PR_EVIDENCE_MISMATCH');
  if(!commit||commit.sha!==P.head||!Array.isArray(commit.files)||commit.files.length!==1||commit.files[0].filename!==C.target.path||commit.files[0].status!=='modified')throw Error('TERMINAL_COMMIT_EVIDENCE_MISMATCH');
  if(!compare||!['ahead','identical'].includes(compare.status)||compare.behind_by!==0||typeof compare.ahead_by!=='number'||compare.ahead_by<0||compare.base_commit?.sha!==P.head)throw Error('TERMINAL_ANCESTRY_UNVERIFIED');
  return 'HISTORIC_COMPLETE_VERIFIED';
}
async function github(path,token){
  const response=await fetch('https://api.github.com/repos/'+C.target.repo+'/'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw Error('GITHUB_EVIDENCE_'+response.status);
  return response.json();
}
async function main(){
  const airtable=process.env.AIRTABLE_TOKEN, githubToken=process.env.GH_TOKEN;
  if(!airtable||!githubToken)throw Error('TERMINAL_EVIDENCE_CREDENTIALS_REQUIRED');
  const record=await req(airtable,'GET');
  if(record.id!==C.record)throw Error('TERMINAL_RECORD_ID_MISMATCH');
  // Reject nonterminal records rather than reactivating an expired historical claim.
  // Future READY/CLAIMED work requires a separately qualified atomic claim gate.
  if((record.fields||{})[C.fields.status]!=='COMPLETE')throw Error('HISTORIC_ORDER_NOT_TERMINAL');
  const [pr,commit,compare]=await Promise.all([
    github('pulls/2',githubToken),
    github('commits/'+P.head,githubToken),
    github('compare/'+P.head+'...main',githubToken)
  ]);
  const decision=verify(record.fields||{},{pr,commit,compare});
  if(process.env.GITHUB_OUTPUT)require('node:fs').appendFileSync(process.env.GITHUB_OUTPUT,'terminal_verified=true\n');
  console.log('AIR_REAL_002_'+decision+' pr='+P.prUrl+' head='+P.head+' merge='+P.merge+' no_writes=true');
}
module.exports={P,verify,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1)});

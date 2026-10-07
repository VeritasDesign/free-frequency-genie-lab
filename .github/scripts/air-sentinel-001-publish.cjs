'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const d=require('./cybertron-airtable-sentinel-dispatcher-v01.cjs'),b=require('./air-sentinel-001-builder.cjs');
const repo='VeritasDesign/free-frequency-genie-lab',branch='factory-air-sentinel-001-real-first',base='factory-builder-95-forecast-coordinate-fix';
const run=(a,cwd)=>cp.execFileSync(a[0],a.slice(1),{cwd,encoding:'utf8',env:a[0]==='gh'?{...process.env,GH_TOKEN:process.env.BUILDER_PR_TOKEN}:process.env}).trim();
if(!process.env.BUILDER_PR_TOKEN)throw Error('EXISTING_BUILDER_PR_TOKEN_REQUIRED');
const v=JSON.parse(fs.readFileSync('evidence/verification.json'));if(v.status!=='PASS'||v.live_nws.status!=='PASS'||v.browser_fixture_tests.length!==2)throw Error('VERIFICATION_REQUIRED');
let sha,changed;
if(process.env.REUSE_CANDIDATE==='true'){
 sha=run(['git','rev-parse','HEAD'],'target');
 changed=run(['git','diff','--name-only',b.PIN,sha],'target').split('\n');
 const old=JSON.parse(fs.readFileSync('target/'+b.ROOT+'FACTORY_EVIDENCE/provenance.json'));
 process.env.ARTIFACT_ID=old.artifact_id;process.env.ARTIFACT_DIGEST=old.artifact_digest;
}else{
const e='target/'+b.ROOT+'FACTORY_EVIDENCE';fs.mkdirSync(e,{recursive:true});
for(const f of ['verification.json','live-nws-envelopes.json','candidate-tests.txt','real-first-tests.txt','recovered-base-tests.txt','candidate-transport-handler-tests.txt'])fs.copyFileSync('evidence/'+f,e+'/'+f);
const provenance={work_order:d.C.id,attempt:d.C.attempt,source_commit:b.PIN,run:process.env.GITHUB_RUN_ID,production_write:false,deploy:false,artifact_id:process.env.ARTIFACT_ID,artifact_digest:process.env.ARTIFACT_DIGEST};fs.writeFileSync(e+'/provenance.json',JSON.stringify(provenance,null,2));
changed=cp.execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:'target',encoding:'utf8'}).trimEnd().split('\n').map(s=>s.slice(3));
const allow=[b.ROOT+'src/app.js',b.ROOT+'src/state.js',b.ROOT+'src/geo.js',b.ROOT+'REAL_FIRST_TESTS.mjs'];if(changed.some(p=>!allow.includes(p)&&!p.startsWith(b.ROOT+'FACTORY_EVIDENCE/')))throw Error('UNBOUNDED_DIFF');
run(['git','switch','-c',branch],'target');run(['git','config','user.name','cybertron-dispatcher[bot]'],'target');run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],'target');run(['git','add',...allow,b.ROOT+'FACTORY_EVIDENCE'],'target');run(['git','diff','--cached','--check'],'target');run(['git','commit','-m','Factory: recover Sentinel real-first NWS experience (AIR-SENTINEL-001)'],'target');
// Only dedicated artifact branch may resume; never update accepted/product production refs.
const refs=run(['git','ls-remote','origin','refs/heads/'+branch],'target');if(refs){const prior=refs.split(/\s/)[0];run(['git','push','--force-with-lease=refs/heads/'+branch+':'+prior,'origin',branch],'target')}else run(['git','push','origin',branch],'target');
sha=run(['git','rev-parse','HEAD'],'target');
}
const body='Factory autonomously consumed AIR-SENTINEL-001 and reused V0.2.1 plus the existing #95 candidate. Explore defaults to NWS coverage; samples remain explicit. Official geometry coordinates use four decimals to avoid the demonstrated NWS precision redirect, without permitting redirects.\n\nValidation: recovered base tests, candidate regressions, transport/handler checks, desktop + mobile browser evidence, pixel-identical Home, and live same-origin NWS MIC111 zone → alerts → point → forecast all PASS. Durable evidence is in FACTORY_EVIDENCE; artifact '+process.env.ARTIFACT_ID+'.\n\nNo product merge or production deployment. Source base '+b.PIN+'; Factory run '+process.env.GITHUB_RUN_ID+'.';fs.writeFileSync('evidence/pr-body.md',body);
const existing=JSON.parse(run(['gh','pr','list','--repo',repo,'--head',branch,'--base',base,'--state','open','--json','url,number']));let pr=existing[0];if(!pr){const url=run(['gh','pr','create','--repo',repo,'--head',branch,'--base',base,'--title','Factory: Sentinel real-first NWS experience (AIR-SENTINEL-001)','--body-file','evidence/pr-body.md']);pr=JSON.parse(run(['gh','pr','view',url,'--repo',repo,'--json','url,number']))}
const read=JSON.parse(run(['gh','pr','view',String(pr.number),'--repo',repo,'--json','headRefOid,baseRefName,state']));if(read.headRefOid!==sha||read.baseRefName!==base||read.state!=='OPEN')throw Error('PR_INDEPENDENT_READBACK_FAILED');
const receipt={status:'COMPLETE',work_order:d.C.id,attempt:d.C.attempt,repository:repo,branch,base_branch:base,source_commit:b.PIN,commit:sha,pr_url:pr.url,pr_number:pr.number,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT,changed_files:changed,tests:'recovered base + candidate + transport/handler + desktop/mobile browser + live NWS PASS',live_nws:v.live_nws,browser_fixture_tests:v.browser_fixture_tests,artifact_id:process.env.ARTIFACT_ID,artifact_digest:process.env.ARTIFACT_DIGEST,production_write:false,deploy:false,preview:'PENDING_SEPARATE_ISOLATED_PREVIEW',next_gate:'Human review; product merge and production release remain gated'};
fs.writeFileSync('evidence/result.json',JSON.stringify(receipt,null,2));fs.writeFileSync('evidence/result-comment.txt','AIR_SENTINEL_001_RESULT_RECEIPT '+JSON.stringify(receipt));console.log('FACTORY_PRODUCT_PR_VERIFIED '+pr.url+' '+sha);

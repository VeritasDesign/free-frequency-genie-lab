'use strict';
// Trusted bounded transport; no eval, shell, user-selected URLs or executable arguments.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const MANIFEST = path.join(__dirname, '../contracts/chief-factory-dispatch-v01.json');
const OWNER = 'Cybertron Chief Factory Bridge v0.1';
const REPO = 'VeritasDesign/free-frequency-genie-lab';
const REQUEST_KEYS = ['schema','work_order_id','correlation_id','contract_id','contract_digest','authorization_ref','task_class','evidence_refs','created_at'];
function fail(code) { throw new Error(code); }
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const equal = (a,b) => canonical(a) === canonical(b);
const digest = v => crypto.createHash('sha256').update(canonical(v)).digest('hex');
function exact(v, keys, code) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !equal(Object.keys(v).sort(), [...keys].sort())) fail(code);
}
function contractDigest(c) { const {authorization, ...immutable} = c; return digest(immutable); }
function validateManifest(m) {
  exact(m,['schema','consumer_enabled','namespace','mailbox','contracts'],'MANIFEST_SHAPE');
  if (m.schema !== 'ChiefFactoryManifest/v0.1' || typeof m.consumer_enabled !== 'boolean' || m.namespace !== 'AIR-BRIDGE-') fail('MANIFEST_IDENTITY');
  const expected = JSON.parse(fs.readFileSync(MANIFEST)).mailbox;
  if (!equal(m.mailbox,expected)) fail('MAILBOX_NOT_ALLOWLISTED');
  if (!Array.isArray(m.contracts) || m.contracts.length !== 1) fail('CONTRACT_AMBIGUITY');
  const c = m.contracts[0];
  exact(c,['id','work_order_id','correlation_id','attempt_id','task_class','worker','target','authority','parameters','prerequisites','evidence_refs','authorization'],'CONTRACT_SHAPE');
  if (c.id !== 'chief-factory-read-checkpoint-v01' || c.work_order_id !== 'AIR-BRIDGE-001' || c.correlation_id !== 'AIR-BRIDGE-001-CHIEF-1' || c.attempt_id !== 'AIR-BRIDGE-001-DISPATCH-1' || c.task_class !== 'read-only-repository-checkpoint' || c.worker !== 'repository-checkpoint-v01') fail('UNSUPPORTED_CONTRACT');
  exact(c.target,['repository','base_branch','source_commit','source_blobs'],'TARGET_SHAPE');
  if (c.target.repository !== REPO || c.target.base_branch !== 'main' || !/^[a-f0-9]{40}$/.test(c.target.source_commit)) fail('TARGET_NOT_ALLOWLISTED');
  const pinned = JSON.parse(fs.readFileSync(MANIFEST)).contracts[0].target;
  if (!equal(c.target,pinned)) fail('SOURCE_CONTRACT_DRIFT');
  if (!equal(c.authority,{scope:'READ_ONLY',production_write:false,deploy:false,merge:false,branch_pr:false,paid_services:false})) fail('AUTHORITY_EXPANSION');
  if (!equal(c.parameters,{}) || !equal(c.prerequisites,[]) || !equal(c.evidence_refs,JSON.parse(fs.readFileSync(MANIFEST)).contracts[0].evidence_refs)) fail('EXECUTABLE_CONFIGURATION_FORBIDDEN');
  if (c.authorization !== null) {
    exact(c.authorization,['ref','approved_by','approved_at','expires_at','contract_digest'],'AUTHORIZATION_SHAPE');
    if (!/^shannon-activation:[A-Za-z0-9-]+$/.test(c.authorization.ref) || c.authorization.approved_by !== 'Shannon' || c.authorization.contract_digest !== contractDigest(c)) fail('AUTHORIZATION_MISMATCH');
    if (!Number.isFinite(Date.parse(c.authorization.approved_at)) || !Number.isFinite(Date.parse(c.authorization.expires_at)) || Date.parse(c.authorization.expires_at) <= Date.parse(c.authorization.approved_at)) fail('AUTHORIZATION_TIME');
  }
  return c;
}
function validateRequest(m, r, now, fresh = true) {
  const c = validateManifest(m);
  exact(r,REQUEST_KEYS,'REQUEST_SHAPE');
  if (r.schema !== 'ChiefFactoryRequest/v0.1' || r.work_order_id !== c.work_order_id || r.correlation_id !== c.correlation_id || r.contract_id !== c.id || r.contract_digest !== contractDigest(c) || r.task_class !== c.task_class || !equal(r.evidence_refs,c.evidence_refs)) fail('UNSUPPORTED_OR_MUTATED_REQUEST');
  if (!c.authorization || r.authorization_ref !== c.authorization.ref) fail('MISSING_OR_MISMATCHED_AUTHORIZATION');
  const created = Date.parse(r.created_at), approved = Date.parse(c.authorization.approved_at), expiry = Date.parse(c.authorization.expires_at);
  if (!Number.isFinite(created) || created < approved || created >= expiry || created > now) fail('REQUEST_TIME');
  if (fresh && (now < approved || now >= expiry)) fail('STALE_AUTHORIZATION');
  return c;
}
function proposedRequest(m, created_at) {
  const c = validateManifest(m);
  return {schema:'ChiefFactoryRequest/v0.1',work_order_id:c.work_order_id,correlation_id:c.correlation_id,contract_id:c.id,contract_digest:contractDigest(c),authorization_ref:c.authorization?.ref ?? 'AWAITING_EXPLICIT_ACTIVATION',task_class:c.task_class,evidence_refs:c.evidence_refs,created_at};
}
const get = (m,r,k) => r.fields[m.mailbox.fields[k]] ?? '';
const fields = (m,obj) => Object.fromEntries(Object.entries(obj).map(([k,v]) => [m.mailbox.fields[k],v]));
function requestFrom(m,row) { try { return JSON.parse(get(m,row,'payload')); } catch { fail('MALFORMED_PAYLOAD'); } }
function unique(rows,id,m) {
  const found = rows.filter(r => get(m,r,'id') === id);
  if (found.length > 1) fail('DUPLICATE_WORK_ORDER');
  return found[0];
}
function evidence(c, commit, blobs) {
  if (commit !== c.target.source_commit || !equal(blobs,c.target.source_blobs)) fail('SOURCE_DRIFT');
  return {schema:'ChiefFactoryCheckpoint/v0.1',repository:c.target.repository,source_commit:commit,source_blobs:blobs,authority:c.authority};
}
function validateOutput(c,output) {
  exact(output,['schema','repository','source_commit','source_blobs','authority'],'OUTPUT_SHAPE');
  if (!equal(output,evidence(c,c.target.source_commit,c.target.source_blobs))) fail('OUTPUT_MISMATCH');
}
function identity(c,r) { return {work_order_id:c.work_order_id,correlation_id:r.correlation_id,contract_id:c.id,contract_digest:contractDigest(c),authorization_ref:r.authorization_ref,attempt_id:c.attempt_id}; }
function validateCheckpoint(c,r,cp) {
  exact(cp,['schema','status','identity','worker','worker_run_id','output','output_digest'],'CHECKPOINT_SHAPE');
  if (cp.schema !== 'ChiefFactoryProgress/v0.1' || cp.status !== 'BUILT' || !equal(cp.identity,identity(c,r)) || cp.worker !== c.worker || !/^[1-9][0-9]*$/.test(cp.worker_run_id)) fail('CHECKPOINT_IDENTITY');
  validateOutput(c,cp.output);
  if (cp.output_digest !== digest(cp.output)) fail('CHECKPOINT_DIGEST');
}
function validateReceipt(c,r,receipt) {
  exact(receipt,['schema','status','identity','worker','worker_run_id','run_id','artifact_id','artifact_digest','output','output_digest','authority'],'RECEIPT_SHAPE');
  if (receipt.schema !== 'ChiefFactoryReceipt/v0.1' || receipt.status !== 'COMPLETE' || !equal(receipt.identity,identity(c,r)) || receipt.worker !== c.worker || !equal(receipt.authority,c.authority)) fail('TERMINAL_IDENTITY_MISMATCH');
  for (const k of ['worker_run_id','run_id','artifact_id']) if (!/^[1-9][0-9]*$/.test(receipt[k])) fail('TERMINAL_EVIDENCE_MISSING');
  if (!/^[a-f0-9]{64}$/.test(receipt.artifact_digest)) fail('ARTIFACT_DIGEST');
  validateOutput(c,receipt.output);
  if (receipt.output_digest !== digest(receipt.output)) fail('TERMINAL_OUTPUT_DIGEST');
}
function rowDecision(m,row,now) {
  const r = requestFrom(m,row), status = get(m,row,'status');
  // Immutable identity/receipt checks precede current expiry/source checks for terminal replay.
  const c = validateRequest(m,r,now,status !== 'COMPLETE');
  if (get(m,row,'id') !== c.work_order_id || get(m,row,'task') !== c.task_class) fail('ROW_IDENTITY');
  if (status === 'COMPLETE') {
    if (get(m,row,'attempt') !== c.attempt_id || get(m,row,'claimed') !== OWNER) fail('FOREIGN_TERMINAL');
    let receipt; try { receipt = JSON.parse(get(m,row,'receipt')); } catch { fail('TERMINAL_EVIDENCE_MISSING'); }
    validateReceipt(c,r,receipt);
    if (get(m,row,'result') !== digest(receipt.output)) fail('RESULT_MISMATCH');
    return {decision:'REPLAY',c,r,receipt};
  }
  if (status === 'READY') {
    if (['attempt','claimed','result','receipt'].some(k => get(m,row,k))) fail('FOREIGN_OR_DIRTY_READY');
    return {decision:'APPLY',c,r};
  }
  if (status === 'CLAIMED') {
    if (get(m,row,'attempt') !== c.attempt_id || get(m,row,'claimed') !== OWNER) fail('FOREIGN_CLAIM');
    if (get(m,row,'receipt')) {
      let cp; try { cp=JSON.parse(get(m,row,'receipt')); } catch { fail('MALFORMED_CHECKPOINT'); }
      if (cp.status === 'COMPLETE') { validateReceipt(c,r,cp); if(get(m,row,'result')!==digest(cp.output)) fail('RESULT_MISMATCH'); return {decision:'FINALIZE',c,r,receipt:cp}; }
      validateCheckpoint(c,r,cp);
      if(get(m,row,'result')!==cp.output_digest) fail('RESULT_MISMATCH');
      return {decision:'REUSE',c,r,checkpoint:cp};
    }
    if(get(m,row,'result')) fail('ORPHAN_RESULT');
    return {decision:'RESUME',c,r};
  }
  fail('STATUS_NOT_EXECUTABLE');
}
async function submit(m,r,db,now) {
  validateRequest(m,r,now,false);
  if (!m.consumer_enabled) fail('ACTIVATION_REQUIRED');
  const existing=unique(await db.list(),r.work_order_id,m);
  if(existing) {
    if(!equal(requestFrom(m,existing),r)) fail('DUPLICATE_REQUEST_CONFLICT');
    if(get(m,existing,'status') !== 'AWAITING_APPROVAL') return {record:existing.id,decision:rowDecision(m,existing,now).decision};
    if(['attempt','claimed','result','receipt'].some(k=>get(m,existing,k))) fail('DIRTY_STAGING');
  }
  validateRequest(m,r,now);
  const staged=existing ?? await db.create(fields(m,{id:r.work_order_id,status:'AWAITING_APPROVAL',task:r.task_class,payload:canonical(r),next:'Awaiting verified READY publication.'}));
  const read=await db.read(staged.id);
  if(!equal(requestFrom(m,read),r) || get(m,read,'status')!=='AWAITING_APPROVAL' || get(m,read,'id')!==r.work_order_id || get(m,read,'task')!==r.task_class) fail('STAGING_READBACK_FAILED');
  const single=unique(await db.list(),r.work_order_id,m);
  if(!single || single.id!==read.id) fail('STAGING_AMBIGUITY');
  await db.patch(read.id,fields(m,{status:'READY',next:'Factory admission pending; no execution claimed.'}));
  if(rowDecision(m,await db.read(read.id),now).decision!=='APPLY') fail('READY_READBACK_FAILED');
  return {record:read.id,decision:'QUEUED'};
}
async function consume(m,db,gh,now,runId) {
  validateManifest(m);
  if(!m.consumer_enabled) return {decision:'DISABLED'};
  if(!/^[1-9][0-9]*$/.test(String(runId))) fail('RUN_ID_REQUIRED');
  const rows=await db.list();
  const candidates=rows.filter(r=>String(get(m,r,'id')).startsWith(m.namespace));
  // Validate every bridge row before any mutation; historical AIR-* rows are untouched.
  const decisions=candidates.map(row=>{unique(rows,get(m,row,'id'),m);if(get(m,row,'status')==='AWAITING_APPROVAL'){validateRequest(m,requestFrom(m,row),now);return {row,decision:'STAGED'};}return {row,...rowDecision(m,row,now)};});
  const executable=decisions.filter(x=>!['REPLAY','STAGED'].includes(x.decision));
  if(executable.length>1) fail('AMBIGUOUS_EXECUTABLE_WORK');
  if(!executable.length) return {decision:decisions.some(x=>x.decision==='REPLAY')?'REPLAY':'IDLE'};
  let d=executable[0], row=d.row;
  if(d.decision==='FINALIZE') {
    await gh.verifyArtifact(d.receipt,false);
    await db.patch(row.id,fields(m,{status:'COMPLETE',next:'Chief independently retrieves and verifies durable receipt.'}));
    const after=rowDecision(m,await db.read(row.id),now);
    if(after.decision!=='REPLAY' || !equal(after.receipt,d.receipt)) fail('COMPLETION_READBACK_FAILED');
    return {decision:'REPLAY'};
  }
  if(d.decision==='APPLY' || d.decision==='RESUME') {
    await gh.preflight(d.c);
    if(d.decision==='APPLY') {
      await db.patch(row.id,fields(m,{status:'CLAIMED',attempt:d.c.attempt_id,claimed:OWNER,next:'Trusted read-only worker executing.'}));
      d={row,...rowDecision(m,await db.read(row.id),now)};
      if(d.decision!=='RESUME') fail('CLAIM_READBACK_FAILED');
    }
    const current=unique(await db.list(),d.c.work_order_id,m);
    if(!current || current.id!==row.id) fail('CLAIM_AMBIGUITY');
    const checked=rowDecision(m,await db.read(row.id),now);
    if(checked.decision!=='RESUME') fail('CLAIM_CHANGED_BEFORE_WORKER');
    const output=await gh.checkpoint(d.c);
    validateOutput(d.c,output);
    const cp={schema:'ChiefFactoryProgress/v0.1',status:'BUILT',identity:identity(d.c,d.r),worker:d.c.worker,worker_run_id:String(runId),output,output_digest:digest(output)};
    await db.patch(row.id,fields(m,{receipt:canonical(cp),result:cp.output_digest,next:'Evidence checkpoint persisted; awaiting artifact and completion.'}));
    const after=rowDecision(m,await db.read(row.id),now);
    if(after.decision!=='REUSE' || !equal(after.checkpoint,cp)) fail('CHECKPOINT_READBACK_FAILED');
    d={...d,checkpoint:cp};
  }
  return {decision:'BUILT',record:row.id,checkpoint:d.checkpoint};
}
async function complete(m,record,artifact,db,gh,now) {
  if(!m.consumer_enabled) fail('ACTIVATION_REQUIRED');
  const row=await db.read(record), d=rowDecision(m,row,now);
  const all=unique(await db.list(),d.c.work_order_id,m);if(!all || all.id!==record) fail('COMPLETION_AMBIGUITY');
  if(d.decision!=='REUSE') fail('CHECKPOINT_REQUIRED');
  exact(artifact,['run_id','artifact_id','artifact_digest'],'ARTIFACT_SHAPE');
  const cp=d.checkpoint;
  const receipt={schema:'ChiefFactoryReceipt/v0.1',status:'COMPLETE',identity:identity(d.c,d.r),worker:d.c.worker,worker_run_id:cp.worker_run_id,...artifact,output:cp.output,output_digest:cp.output_digest,authority:d.c.authority};
  validateReceipt(d.c,d.r,receipt);
  await gh.verifyArtifact(receipt,false);
  // Save a valid terminal checkpoint before publishing COMPLETE; interrupted finalization is recoverable.
  await db.patch(record,fields(m,{receipt:canonical(receipt),result:receipt.output_digest}));
  const pending=rowDecision(m,await db.read(record),now);
  if(pending.decision!=='FINALIZE' || !equal(pending.receipt,receipt)) fail('PENDING_RECEIPT_READBACK_FAILED');
  await db.patch(record,fields(m,{status:'COMPLETE',next:'Chief independently retrieves and verifies durable receipt.'}));
  const after=rowDecision(m,await db.read(record),now);
  if(after.decision!=='REPLAY' || !equal(after.receipt,receipt)) fail('COMPLETION_READBACK_FAILED');
  return receipt;
}
async function retrieve(m,record,expected,db,gh,now) {
  const row=await db.read(record), d=rowDecision(m,row,now);
  const one=unique(await db.list(),d.c.work_order_id,m);if(!one || one.id!==record) fail('RETRIEVAL_AMBIGUITY');
  if(!equal(d.r,expected)) fail('RETRIEVAL_CORRELATION_MISMATCH');
  if(d.decision!=='REPLAY') fail('NOT_COMPLETE');
  await gh.verifyArtifact(d.receipt,true);
  const independent=await gh.checkpoint(d.c);
  if(!equal(independent,d.receipt.output)) fail('INDEPENDENT_SOURCE_MISMATCH');
  return {status:'VERIFIED_COMPLETE',record,receipt:d.receipt};
}
function airtableClient(m,token) {
  if(!token) fail('AIRTABLE_TOKEN_REQUIRED');
  const root='https://api.airtable.com/v0/'+m.mailbox.base+'/'+m.mailbox.table;
  async function req(method,suffix,body) {
    const r=await fetch(root+suffix,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
    if(!r.ok) fail('AIRTABLE_HTTP_'+r.status);return r.json();
  }
  const validId=id=>{if(!/^rec[A-Za-z0-9]{14}$/.test(id)) fail('RECORD_ID');return id;};
  return {
    async list(){const rows=[];let offset;do{const q=new URLSearchParams({returnFieldsByFieldId:'true',pageSize:'100'});if(offset)q.set('offset',offset);const r=await req('GET','?'+q);rows.push(...r.records);offset=r.offset;}while(offset);return rows;},
    read:id=>req('GET','/'+validId(id)+'?returnFieldsByFieldId=true'),
    patch:(id,f)=>req('PATCH','/'+validId(id)+'?returnFieldsByFieldId=true',{fields:f,typecast:false}),
    create:f=>req('POST','?returnFieldsByFieldId=true',{fields:f,typecast:false})
  };
}
function githubClient(token) {
  if(!token) fail('GITHUB_TOKEN_REQUIRED');
  async function get(suffix){const r=await fetch('https://api.github.com/repos/'+REPO+suffix,{redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!r.ok)fail('GITHUB_HTTP_'+r.status);return r.json();}
  return {
    async preflight(c){const compare=await get('/compare/'+c.target.source_commit+'...main');if(!['ahead','identical'].includes(compare.status)||compare.merge_base_commit.sha!==c.target.source_commit)fail('BASE_SOURCE_DRIFT');await this.checkpoint(c);},
    async checkpoint(c){const commit=await get('/commits/'+c.target.source_commit);const blobs={};for(const p of Object.keys(c.target.source_blobs)){const file=await get('/contents/'+p+'?ref='+c.target.source_commit);if(file.type!=='file')fail('SOURCE_TYPE');blobs[p]=file.sha;}return evidence(c,commit.sha,blobs);},
    async verifyArtifact(receipt,requireSuccess){const run=await get('/actions/runs/'+receipt.run_id), artifact=await get('/actions/artifacts/'+receipt.artifact_id);if(run.repository.full_name!==REPO||run.head_branch!=='main'||run.path!=='.github/workflows/chief-factory-dispatch-v01.yml'||!['schedule','workflow_dispatch'].includes(run.event)||artifact.expired||artifact.name!=='chief-factory-bridge-evidence'||String(artifact.workflow_run?.id)!==receipt.run_id||artifact.digest!=='sha256:'+receipt.artifact_digest)fail('ARTIFACT_PROVENANCE');if(requireSuccess&&(run.status!=='completed'||run.conclusion!=='success'))fail('RUN_NOT_SUCCESSFUL');}
  };
}
async function cli() {
  const m=JSON.parse(fs.readFileSync(MANIFEST)), command=process.argv[2], now=Date.now();
  if(command==='propose') {console.log(JSON.stringify(proposedRequest(m,'SET_AT_AUTHORIZED_SUBMISSION'),null,2));return;}
  if(command==='consume'&&!m.consumer_enabled){validateManifest(m);console.log('BRIDGE_DISABLED_ACTIVATION_REQUIRED');if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'decision=DISABLED\n');return;}
  if(!['consume','complete','retrieve'].includes(command)) fail('UNSUPPORTED_COMMAND');
  if(command!=='retrieve'&&!m.consumer_enabled) fail('ACTIVATION_REQUIRED');
  const db=airtableClient(m,process.env.AIRTABLE_TOKEN),gh=githubClient(process.env.GH_TOKEN);
  if(command==='consume') {
    const result=await consume(m,db,gh,now,process.env.GITHUB_RUN_ID);
    fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/bridge-state.json',JSON.stringify(result,null,2));
    if(result.checkpoint) fs.writeFileSync('evidence/bridge-checkpoint.json',JSON.stringify(result.checkpoint,null,2));
    if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,'decision='+result.decision+'\n');
    console.log('BRIDGE_'+result.decision);return;
  }
  if(command==='complete') {
    const state=JSON.parse(fs.readFileSync('evidence/bridge-state.json'));
    const receipt=await complete(m,state.record,{run_id:process.env.GITHUB_RUN_ID,artifact_id:process.env.ARTIFACT_ID,artifact_digest:process.env.ARTIFACT_DIGEST},db,gh,now);
    fs.writeFileSync('evidence/bridge-receipt.json',JSON.stringify(receipt,null,2));console.log('DURABLE_COMPLETE '+receipt.identity.work_order_id);return;
  }
  const expected=JSON.parse(fs.readFileSync(process.argv[4]));
  console.log(JSON.stringify(await retrieve(m,process.argv[3],expected,db,gh,now),null,2));
}
module.exports={OWNER,REPO,canonical,digest,contractDigest,validateManifest,validateRequest,proposedRequest,fields,get,evidence,rowDecision,submit,consume,complete,retrieve,airtableClient,githubClient};
if(require.main===module) cli().catch(e=>{console.error(e.message);process.exitCode=1;});

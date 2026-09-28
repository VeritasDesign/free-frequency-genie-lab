'use strict';

// CYBERTRON v0.4 — separate, fixed-operation worker; never run user code.
// GitHub's repository-scoped write token is NOT a path-scoped capability.
// Everything executable is fixed below; public issues provide only a commit pin.
module.exports = async function cybertronV04({github, context, core}) {
  const owner = context.repo.owner, repo = context.repo.repo;
  const issue_number = context.issue.number, run_id = context.runId;
  const trusted = 'VeritasDesign', branch = 'cybertron-v04-isolated';
  const receiptPrefix = 'CYBERTRON_V04_RECEIPT ';
  const claimPrefix = 'CYBERTRON_V04_CLAIM ';
  const statusPrefix = 'CYBERTRON_V04_STATUS ';
  const fs = require('node:fs'), os = require('node:os');
  const pathLib = require('node:path'), child = require('node:child_process');
  const crypto = require('node:crypto');

  const specs = {
    'normalize-label-v1': {
      filename:'labels.cjs',
      before: "'use strict';\n\nfunction formatLabel(label) {\n  if (typeof label !== 'string') return '';\n  return label;\n}\n\nmodule.exports = { formatLabel };\n",
      from:'  return label;',
      to:'  return label.trim().toUpperCase();',
      acceptance:'trim and uppercase valid labels; preserve empty fallback; pass fixed Node tests',
      tests:[
        "test('trims and uppercases',()=>assert.equal(formatLabel('  echo  '),'ECHO'));",
        "test('mixed case',()=>assert.equal(formatLabel('Lab'),'LAB'));",
        "test('empty input',()=>assert.equal(formatLabel('  '),''));",
        "test('non-string fallback',()=>assert.equal(formatLabel(null),''));"
      ],
      symbol:'formatLabel'
    },
    'cap-count-v1': {
      filename:'counter.cjs',
      before: "'use strict';\n\nfunction safeCount(count) {\n  if (!Number.isInteger(count) || count < 0) return 0;\n  return count;\n}\n\nmodule.exports = { safeCount };\n",
      from:'  return count;',
      to:'  return Math.min(count, 5);',
      acceptance:'cap valid counts at five; preserve invalid fallback; pass fixed Node tests',
      tests:[
        "test('under cap unchanged',()=>assert.equal(safeCount(3),3));",
        "test('over cap limited',()=>assert.equal(safeCount(27),5));",
        "test('negative falls back',()=>assert.equal(safeCount(-2),0));",
        "test('fractional falls back',()=>assert.equal(safeCount(2.5),0));",
        "test('non-numeric falls back',()=>assert.equal(safeCount('9'),0));"
      ],
      symbol:'safeCount'
    }
  };
  let id='UNKNOWN', authorization_commit=null, target_path=null, source_before_sha=null;
  let source_after_sha=null, source_commit=null, committed=false, changed_files=[];
  let tests={status:'NOT_RUN'};
  const current = async () => (await github.rest.issues.get({owner,repo,issue_number})).data;
  const post = (prefix,payload) => github.rest.issues.createComment({
    owner,repo,issue_number,body:prefix+JSON.stringify(payload)
  });
  const receipt = async (status, fields={}) => {
    const record = Object.assign({
      version:'0.4',id,issue_number,run_id,status,authorization_commit,
      target_branch:branch,target_path,source_before_sha,source_after_sha,
      source_commit,changed_files,tests,committed,production_release:false
    },fields);
    await post(receiptPrefix,record);
    core.info('CYBERTRON_V04_RESULT '+JSON.stringify(record));
    return record;
  };
  const stop = async (status,reason,fields={}) => {
    await receipt(status,Object.assign({reason},fields));
    if(status==='BLOCKED'||status==='FAILED'||status==='FAILED_AFTER_COMMIT')
      core.setFailed('CYBERTRON_V04 '+status+': '+reason);
  };
  const titleMatch = title => /^\[CYBERTRON V04\] (CYB-V04-[0-9]{3,6})$/.exec(title || '');
  const bodyMatch = body => /^<!-- CYBERTRON-V04 auth_commit=([a-f0-9]{40}) -->$/.exec((body || '').trim());
  const stillAuthorized = async original => {
    const live=await current();
    return {closed:live.state!=='open',
      mutated:live.body!==original.body || live.title!==original.title};
  };
  const ancestor = async (base,head) => {
    const v=(await github.rest.repos.compareCommits({owner,repo,base,head})).data;
    return v.behind_by===0 && ['identical','ahead'].includes(v.status);
  };
  const readFile = async (path,ref) => {
    const v=(await github.rest.repos.getContent({owner,repo,path,ref})).data;
    if(Array.isArray(v)||v.type!=='file')return null;
    return {sha:v.sha,text:Buffer.from(v.content,'base64').toString('utf8')};
  };
  const gitBlob = contents=>crypto.createHash('sha1')
      .update('blob '+Buffer.byteLength(contents,'utf8')+'\0'+contents).digest('hex');

  try {
    const initial=await current();
    const title=titleMatch(initial.title);
    if(title) id=title[1];

    // The first operation, before parsing editable text, prevents second
    // BLOCKED receipts on events queued by an edit during an active run.
    // Both successful and denied orders are terminal on THIS issue number.
    const comments=await github.paginate(github.rest.issues.listComments,{
      owner,repo,issue_number,per_page:100
    });
    const bot=comments.filter(c=>c.user?.login==='github-actions[bot]');
    if(bot.some(c=>c.body?.startsWith(receiptPrefix))) {
      core.info('CYBERTRON_V04_TERMINAL_RECEIPT_SKIP '+id);return;
    }
    if(bot.some(c=>c.body?.startsWith(claimPrefix))) {
      core.info('CYBERTRON_V04_PRIOR_CLAIM_SKIP '+id);return;
    }

    if(!title) {await stop('BLOCKED','Invalid v0.4 title or work-order ID');return;}
    if(initial.user?.login!==trusted) {
      await stop('BLOCKED','Requester not allowlisted repository owner');return;
    }
    const pin=bodyMatch(initial.body);
    if(!pin) {await stop('BLOCKED','Missing or edited exact authorization pin');return;}
    authorization_commit=pin[1];

    // Live titles can be edited, so durable owner-authored Git manifests
    // also reserve IDs. Do not rely only on the current title of old issues.
    const issues=await github.paginate(github.rest.issues.listForRepo,{
      owner,repo,state:'all',per_page:100
    });
    const titleReservations=issues.filter(issue=>
      issue.number<issue_number &&
      issue.user?.login===trusted &&
      (issue.title==='[CYBERTRON V04] '+id ||
       issue.title==='[CYBERTRON V04 DRAFT] '+id)
    ).map(issue=>issue.number);
    const registry=(await github.rest.repos.getContent({
      owner,repo,path:'recovery/authorizations/v04',ref:'main'
    })).data;
    if(!Array.isArray(registry) || registry.length>=1000) {
      await stop('BLOCKED','Manifest registry unavailable or too large to validate safely');return;
    }
    const filePattern=new RegExp('^'+id+'_ISSUE-([0-9]+)\\.json
    const manifestPath='recovery/authorizations/v04/'+id+'_ISSUE-'+issue_number+'.json';
    let auth;
    try {
      auth=(await github.rest.repos.getCommit({owner,repo,ref:authorization_commit})).data;
    } catch(err) {
      if(err.status===404||err.status===422) {
        await stop('BLOCKED','Pinned authorization commit not found');return;
      }
      throw err;
    }
    if(auth.author?.login!==trusted ||
       auth.files?.length!==1 ||
       auth.files[0].filename!==manifestPath ||
       auth.files[0].status!=='added' ||
       !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Commit is not an owner-authored single-manifest addition reachable from main');return;
    }
    const manifestFile=await readFile(manifestPath,authorization_commit);
    let order;
    try {order=JSON.parse(manifestFile?.text ?? '');}
    catch(_) {await stop('BLOCKED','Malformed pinned manifest');return;}
    const keys=[
      'acceptance','expected_source_sha','fixture_commit','id','issue_number',
      'production_release','requester','scope','target_branch','target_path',
      'target_repository','task_type','test_delay_seconds','version','worker'
    ].sort();
    const spec=specs[order?.task_type];
    const valid=!!spec && order && !Array.isArray(order) &&
      JSON.stringify(Object.keys(order).sort())===JSON.stringify(keys) &&
      order.version==='0.4' && order.worker==='cybertron-v04' &&
      order.id===id && order.issue_number===issue_number &&
      order.requester===trusted && order.target_repository===owner+'/'+repo &&
      order.target_branch===branch &&
      order.target_path==='sandbox/v04/'+id+'/'+spec.filename &&
      /^[a-f0-9]{40}$/.test(order.fixture_commit) &&
      /^[a-f0-9]{40}$/.test(order.expected_source_sha) &&
      order.expected_source_sha===gitBlob(spec.before) &&
      order.scope==='exact-fixed-line-replacement' &&
      order.acceptance===spec.acceptance &&
      order.production_release===false &&
      [0,25].includes(order.test_delay_seconds);
    if(!valid) {await stop('BLOCKED','Exact operation, target, expected source or acceptance not allowlisted');return;}
    target_path=order.target_path;
    source_before_sha=order.expected_source_sha;

    // Each fixture must be newly ADDED in an independent owner-authored
    // commit on this dedicated branch, not silently reset or reused.
    let fixture;
    try {fixture=(await github.rest.repos.getCommit({
      owner,repo,ref:order.fixture_commit
    })).data;} catch(err) {
      if(err.status===404||err.status===422) {
        await stop('BLOCKED','Fixture commit not found');return;
      } throw err;
    }
    if(fixture.author?.login!==trusted || fixture.files?.length!==1 ||
       fixture.files[0].filename!==target_path ||
       fixture.files[0].status!=='added' ||
       !(await ancestor(order.fixture_commit,branch))) {
      await stop('BLOCKED','Fixture was not independently added on the isolated branch');return;
    }
    const fixtureFile=await readFile(target_path,order.fixture_commit);
    if(!fixtureFile || fixtureFile.sha!==source_before_sha ||
       fixtureFile.text!==spec.before) {
      await stop('BLOCKED','Pinned fixture commit has wrong initial source');return;
    }

    let live=await stillAuthorized(initial);
    if(live.closed) {await receipt('CANCELLED',{reason:'Issue closed before claim'});return;}
    if(live.mutated) {await stop('BLOCKED','Issue title/body changed before claim');return;}

    await post(claimPrefix,{id,issue_number,status:'CLAIMED',run_id,authorization_commit});
    await post(statusPrefix,{id,status:'RUNNING',run_id,committed:false});

    if(order.test_delay_seconds===25)
      await new Promise(resolve=>setTimeout(resolve,25000));

    live=await stillAuthorized(initial);
    if(live.closed) {
      await receipt('CANCELLED',{reason:'Closed during precommit execution; no source write'});return;
    }
    if(live.mutated || !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Postclaim order mutation or revoked authorization; no write');return;
    }

    const original=await readFile(target_path,branch);
    if(!original || original.sha!==source_before_sha ||
       original.text!==spec.before) {
      await stop('BLOCKED','BASELINE_MISMATCH: target differs from expected fresh fixture',{
        observed_source_sha:original?.sha ?? null
      });return;
    }
    if(spec.before.split(spec.from).length!==2) {
      await stop('BLOCKED','Fixed operation source token is not unique');return;
    }
    const changed=spec.before.replace(spec.from,spec.to);
    if(changed===spec.before || changed.split('\n').length!==spec.before.split('\n').length) {
      await stop('BLOCKED','Fixed one-line diff invariant failed');return;
    }

    // All tested source bytes equal a code-owned exact template.
    // Public manifest text is NEVER run as code or shell.
    const directory=fs.mkdtempSync(pathLib.join(os.tmpdir(),'cybertron-v04-'));
    try {
      fs.writeFileSync(pathLib.join(directory,'target.cjs'),changed,'utf8');
      const testSource=[
        "'use strict';",
        "const test=require('node:test');",
        "const assert=require('node:assert/strict');",
        "const {"+spec.symbol+"}=require('./target.cjs');",
        ...spec.tests
      ].join('\n')+'\n';
      fs.writeFileSync(pathLib.join(directory,'target.test.cjs'),testSource,'utf8');
      const syntax=child.spawnSync(process.execPath,['--check','target.cjs'],{
        cwd:directory,encoding:'utf8',timeout:15000
      });
      const verification=child.spawnSync(process.execPath,['--test','target.test.cjs'],{
        cwd:directory,encoding:'utf8',timeout:30000
      });
      tests={
        status:syntax.status===0 && verification.status===0?'PASS':'FAIL',
        syntax_exit:syntax.status,node_test_exit:verification.status,
        summary:(verification.stdout||'').slice(-1600),
        stderr:(syntax.stderr||verification.stderr||'').slice(-500)
      };
    } finally {
      fs.rmSync(directory,{recursive:true,force:true});
    }
    if(tests.status!=='PASS') {await stop('FAILED','Fixed Node behavioral tests failed; no commit');return;}

    live=await stillAuthorized(initial);
    if(live.closed) {
      await receipt('CANCELLED',{reason:'Closed after tests and before source write'});return;
    }
    if(live.mutated || !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Order mutated or pin revoked before source write');return;
    }

    // Compare-and-swap: GitHub requires the exact authorized old blob SHA.
    // Distinct issues get distinct fixture paths. The token itself still has
    // repository-wide write permission; code guards, not GitHub ACLs, constrain it.
    const write=(await github.rest.repos.createOrUpdateFileContents({
      owner,repo,path:target_path,branch,sha:source_before_sha,
      content:Buffer.from(changed,'utf8').toString('base64'),
      message:'CYBERTRON '+id+': isolated '+order.task_type
    })).data;
    committed=true;
    source_commit=write.commit.sha;
    changed_files=[target_path];
    source_after_sha=gitBlob(changed);

    const remote=await readFile(target_path,source_commit);
    const commit=(await github.rest.repos.getCommit({owner,repo,ref:source_commit})).data;
    const exactDiff=commit.files?.length===1 &&
      commit.files[0].filename===target_path &&
      commit.files[0].status==='modified' &&
      commit.files[0].patch?.includes('-'+spec.from+'\n+'+spec.to);
    if(!remote || remote.sha!==source_after_sha ||
       remote.text!==changed || !exactDiff) {
      await stop('FAILED_AFTER_COMMIT','Committed source failed remote diff/readback; manual inspection required',{
        observed_commit_files:commit.files?.map(f=>f.filename)||[]
      });return;
    }
    const final=await current();
    await receipt(final.state==='open'?'COMPLETE':'COMPLETE_CANCEL_REQUESTED',{
      reason:final.state==='open'?
        'Exact source change committed and independently read back; tests pass':
        'Cancellation observed after commit; no rollback attempted',
      cancel_requested:final.state!=='open',
      changed_file_diff:'-'+spec.from+'\n+'+spec.to,
      commit_url:write.commit.html_url
    });
  } catch(err) {
    core.error('CYBERTRON_V04_EXCEPTION '+String(err?.message||err));
    try {
      await receipt(committed?'FAILED_AFTER_COMMIT':'FAILED',{
        reason:String(err?.message||err).slice(0,250),
        note:committed?'Source may be committed; inspect branch before any retry':'No successful source commit recorded by this run'
      });
    } catch(reportErr) {core.error('CYBERTRON_V04_RECEIPT_FAILURE '+String(reportErr));}
    core.setFailed('CYBERTRON_V04 worker error; manual inspection before retry');
  }
};
);
    const durableReservations=registry.map(f=>filePattern.exec(f.name||''))
      .filter(Boolean).map(m=>Number(m[1])).filter(n=>n<issue_number);
    const duplicates=[...titleReservations,...durableReservations];
    if(duplicates.length) {
      await stop('BLOCKED','Duplicate work-order ID; canonical issue #'+
        Math.min(...duplicates));return;
    }

    const manifestPath='recovery/authorizations/v04/'+id+'_ISSUE-'+issue_number+'.json';
    let auth;
    try {
      auth=(await github.rest.repos.getCommit({owner,repo,ref:authorization_commit})).data;
    } catch(err) {
      if(err.status===404||err.status===422) {
        await stop('BLOCKED','Pinned authorization commit not found');return;
      }
      throw err;
    }
    if(auth.author?.login!==trusted ||
       auth.files?.length!==1 ||
       auth.files[0].filename!==manifestPath ||
       auth.files[0].status!=='added' ||
       !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Commit is not an owner-authored single-manifest addition reachable from main');return;
    }
    const manifestFile=await readFile(manifestPath,authorization_commit);
    let order;
    try {order=JSON.parse(manifestFile?.text ?? '');}
    catch(_) {await stop('BLOCKED','Malformed pinned manifest');return;}
    const keys=[
      'acceptance','expected_source_sha','fixture_commit','id','issue_number',
      'production_release','requester','scope','target_branch','target_path',
      'target_repository','task_type','test_delay_seconds','version','worker'
    ].sort();
    const spec=specs[order?.task_type];
    const valid=!!spec && order && !Array.isArray(order) &&
      JSON.stringify(Object.keys(order).sort())===JSON.stringify(keys) &&
      order.version==='0.4' && order.worker==='cybertron-v04' &&
      order.id===id && order.issue_number===issue_number &&
      order.requester===trusted && order.target_repository===owner+'/'+repo &&
      order.target_branch===branch &&
      order.target_path==='sandbox/v04/'+id+'/'+spec.filename &&
      /^[a-f0-9]{40}$/.test(order.fixture_commit) &&
      /^[a-f0-9]{40}$/.test(order.expected_source_sha) &&
      order.expected_source_sha===gitBlob(spec.before) &&
      order.scope==='exact-fixed-line-replacement' &&
      order.acceptance===spec.acceptance &&
      order.production_release===false &&
      [0,25].includes(order.test_delay_seconds);
    if(!valid) {await stop('BLOCKED','Exact operation, target, expected source or acceptance not allowlisted');return;}
    target_path=order.target_path;
    source_before_sha=order.expected_source_sha;

    // Each fixture must be newly ADDED in an independent owner-authored
    // commit on this dedicated branch, not silently reset or reused.
    let fixture;
    try {fixture=(await github.rest.repos.getCommit({
      owner,repo,ref:order.fixture_commit
    })).data;} catch(err) {
      if(err.status===404||err.status===422) {
        await stop('BLOCKED','Fixture commit not found');return;
      } throw err;
    }
    if(fixture.author?.login!==trusted || fixture.files?.length!==1 ||
       fixture.files[0].filename!==target_path ||
       fixture.files[0].status!=='added' ||
       !(await ancestor(order.fixture_commit,branch))) {
      await stop('BLOCKED','Fixture was not independently added on the isolated branch');return;
    }
    const fixtureFile=await readFile(target_path,order.fixture_commit);
    if(!fixtureFile || fixtureFile.sha!==source_before_sha ||
       fixtureFile.text!==spec.before) {
      await stop('BLOCKED','Pinned fixture commit has wrong initial source');return;
    }

    let live=await stillAuthorized(initial);
    if(live.closed) {await receipt('CANCELLED',{reason:'Issue closed before claim'});return;}
    if(live.mutated) {await stop('BLOCKED','Issue title/body changed before claim');return;}

    await post(claimPrefix,{id,issue_number,status:'CLAIMED',run_id,authorization_commit});
    await post(statusPrefix,{id,status:'RUNNING',run_id,committed:false});

    if(order.test_delay_seconds===25)
      await new Promise(resolve=>setTimeout(resolve,25000));

    live=await stillAuthorized(initial);
    if(live.closed) {
      await receipt('CANCELLED',{reason:'Closed during precommit execution; no source write'});return;
    }
    if(live.mutated || !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Postclaim order mutation or revoked authorization; no write');return;
    }

    const original=await readFile(target_path,branch);
    if(!original || original.sha!==source_before_sha ||
       original.text!==spec.before) {
      await stop('BLOCKED','BASELINE_MISMATCH: target differs from expected fresh fixture',{
        observed_source_sha:original?.sha ?? null
      });return;
    }
    if(spec.before.split(spec.from).length!==2) {
      await stop('BLOCKED','Fixed operation source token is not unique');return;
    }
    const changed=spec.before.replace(spec.from,spec.to);
    if(changed===spec.before || changed.split('\n').length!==spec.before.split('\n').length) {
      await stop('BLOCKED','Fixed one-line diff invariant failed');return;
    }

    // All tested source bytes equal a code-owned exact template.
    // Public manifest text is NEVER run as code or shell.
    const directory=fs.mkdtempSync(pathLib.join(os.tmpdir(),'cybertron-v04-'));
    try {
      fs.writeFileSync(pathLib.join(directory,'target.cjs'),changed,'utf8');
      const testSource=[
        "'use strict';",
        "const test=require('node:test');",
        "const assert=require('node:assert/strict');",
        "const {"+spec.symbol+"}=require('./target.cjs');",
        ...spec.tests
      ].join('\n')+'\n';
      fs.writeFileSync(pathLib.join(directory,'target.test.cjs'),testSource,'utf8');
      const syntax=child.spawnSync(process.execPath,['--check','target.cjs'],{
        cwd:directory,encoding:'utf8',timeout:15000
      });
      const verification=child.spawnSync(process.execPath,['--test','target.test.cjs'],{
        cwd:directory,encoding:'utf8',timeout:30000
      });
      tests={
        status:syntax.status===0 && verification.status===0?'PASS':'FAIL',
        syntax_exit:syntax.status,node_test_exit:verification.status,
        summary:(verification.stdout||'').slice(-1600),
        stderr:(syntax.stderr||verification.stderr||'').slice(-500)
      };
    } finally {
      fs.rmSync(directory,{recursive:true,force:true});
    }
    if(tests.status!=='PASS') {await stop('FAILED','Fixed Node behavioral tests failed; no commit');return;}

    live=await stillAuthorized(initial);
    if(live.closed) {
      await receipt('CANCELLED',{reason:'Closed after tests and before source write'});return;
    }
    if(live.mutated || !(await ancestor(authorization_commit,'main'))) {
      await stop('BLOCKED','Order mutated or pin revoked before source write');return;
    }

    // Compare-and-swap: GitHub requires the exact authorized old blob SHA.
    // Distinct issues get distinct fixture paths. The token itself still has
    // repository-wide write permission; code guards, not GitHub ACLs, constrain it.
    const write=(await github.rest.repos.createOrUpdateFileContents({
      owner,repo,path:target_path,branch,sha:source_before_sha,
      content:Buffer.from(changed,'utf8').toString('base64'),
      message:'CYBERTRON '+id+': isolated '+order.task_type
    })).data;
    committed=true;
    source_commit=write.commit.sha;
    changed_files=[target_path];
    source_after_sha=gitBlob(changed);

    const remote=await readFile(target_path,source_commit);
    const commit=(await github.rest.repos.getCommit({owner,repo,ref:source_commit})).data;
    const exactDiff=commit.files?.length===1 &&
      commit.files[0].filename===target_path &&
      commit.files[0].status==='modified' &&
      commit.files[0].patch?.includes('-'+spec.from+'\n+'+spec.to);
    if(!remote || remote.sha!==source_after_sha ||
       remote.text!==changed || !exactDiff) {
      await stop('FAILED_AFTER_COMMIT','Committed source failed remote diff/readback; manual inspection required',{
        observed_commit_files:commit.files?.map(f=>f.filename)||[]
      });return;
    }
    const final=await current();
    await receipt(final.state==='open'?'COMPLETE':'COMPLETE_CANCEL_REQUESTED',{
      reason:final.state==='open'?
        'Exact source change committed and independently read back; tests pass':
        'Cancellation observed after commit; no rollback attempted',
      cancel_requested:final.state!=='open',
      changed_file_diff:'-'+spec.from+'\n+'+spec.to,
      commit_url:write.commit.html_url
    });
  } catch(err) {
    core.error('CYBERTRON_V04_EXCEPTION '+String(err?.message||err));
    try {
      await receipt(committed?'FAILED_AFTER_COMMIT':'FAILED',{
        reason:String(err?.message||err).slice(0,250),
        note:committed?'Source may be committed; inspect branch before any retry':'No successful source commit recorded by this run'
      });
    } catch(reportErr) {core.error('CYBERTRON_V04_RECEIPT_FAILURE '+String(reportErr));}
    core.setFailed('CYBERTRON_V04 worker error; manual inspection before retry');
  }
};

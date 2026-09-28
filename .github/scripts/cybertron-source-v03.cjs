'use strict';

// CYBERTRON SOURCE v0.3: purpose-built, one-file, one-transition worker.
// Orders are authorized by a manifest in a commit reachable from main.
// This is NOT an arbitrary code-execution or production-deployment engine.
module.exports = async function cybertronSourceV03({github, context, core}) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const issue_number = context.issue.number;
  const run_id = context.runId;
  const trusted = 'VeritasDesign';
  const issuePrefix = '[CYBERTRON SOURCE] ';
  const receiptPrefix = 'CYBERTRON_SOURCE_RECEIPT_V0.3 ';
  const claimPrefix = 'CYBERTRON_SOURCE_CLAIM_V0.3 ';
  const statusPrefix = 'CYBERTRON_SOURCE_STATUS_V0.3 ';
  const branch = 'cybertron-v03-isolated';
  const path = 'sandbox/dispatch-target.cjs';
  const beforeSha = 'ba27e3f685cac94b609d2fa8ea067436a416da79';
  const beforeLiteral = "const EMPTY_GREETING = 'Ready.';";
  const afterLiteral = "const EMPTY_GREETING = 'Systems ready.';";
  const acceptance = 'empty input returns Systems ready.; named input unchanged; node tests pass';
  let id = 'UNKNOWN';
  let auth_commit = null;
  let committed = false;
  let source_commit = null;
  let changed_files = [];
  let tests = {status:'NOT_RUN'};
  let observed_source_sha = null;

  const current = async () => (await github.rest.issues.get({owner, repo, issue_number})).data;
  const comment = async (prefix, obj) =>
    github.rest.issues.createComment({owner, repo, issue_number, body:prefix+JSON.stringify(obj)});
  const receipt = async (status, extra = {}) => {
    const record = Object.assign({
      version:'0.3', id, issue_number, status, authorization_commit:auth_commit,
      source_commit, source_before_sha:beforeSha, source_after_sha:observed_source_sha,
      changed_files, test_results:tests, run_id, committed, production_release:false
    }, extra);
    await comment(receiptPrefix, record);
    core.info('CYBERTRON_SOURCE_RESULT '+JSON.stringify(record));
    return record;
  };
  const stop = async (status, reason) => {
    await receipt(status, {reason});
    if (status === 'BLOCKED' || status === 'FAILED') core.setFailed(status+': '+reason);
  };
  const matchTitle = (title) => /^\[CYBERTRON SOURCE\] (CYB-SRC-[0-9]{3,6})$/.exec(title || '');
  const matchBody = (body) => /^<!-- CYBERTRON-SOURCE-V0\.3 auth_commit=([a-f0-9]{40}) -->$/.exec((body || '').trim());
  const isBot = (c) => c.user && c.user.login === 'github-actions[bot]';
  const checkLive = async (auth) => {
    const live = await current();
    return {closed:live.state !== 'open', altered:live.body !== auth, titleChanged:!matchTitle(live.title) || matchTitle(live.title)[1] !== id};
  };
  const checkAuthorizationAncestry = async (sha) => {
    const compare = (await github.rest.repos.compareCommits({owner,repo,base:sha,head:'main'})).data;
    return compare.behind_by === 0 && ['ahead','identical'].includes(compare.status);
  };

  try {
    const first = await current();
    const titleMatch = matchTitle(first.title);
    if (!titleMatch) { await stop('BLOCKED','Title does not match fixed source order format'); return; }
    id = titleMatch[1];
    if (!first.user || first.user.login !== trusted) {
      await stop('BLOCKED','Requester is not allowlisted repository owner'); return;
    }
    const bodyMatch = matchBody(first.body);
    if (!bodyMatch) { await stop('BLOCKED','Missing or malformed commit-pinned authorization'); return; }
    auth_commit = bodyMatch[1];

    const comments = await github.paginate(github.rest.issues.listComments,{owner,repo,issue_number,per_page:100});
    const botComments = comments.filter(isBot);
    const parsed = (prefix) => botComments.filter(c=>c.body && c.body.startsWith(prefix)).map(c=>{
      try { return JSON.parse(c.body.slice(prefix.length)); } catch(_) {return {};}
    });
    const existing = parsed(receiptPrefix);
    if (existing.some(r=>r.id===id && (r.committed || ['COMPLETE','COMPLETE_CANCEL_REQUESTED','CANCELLED'].includes(r.status)))) {
      core.info('CYBERTRON_SOURCE_TERMINAL_SKIP '+id); return;
    }
    if (existing.some(r=>r.id===id && r.authorization_commit===auth_commit && r.status==='BLOCKED')) {
      core.info('CYBERTRON_SOURCE_BLOCKED_SKIP '+id); return;
    }
    if (parsed(claimPrefix).some(c=>c.id===id)) {
      core.info('CYBERTRON_SOURCE_PRIOR_CLAIM_SKIP '+id); return;
    }

    // Duplicate IDs: only trusted requester's earlier issues can reserve a name.
    // This is a deterministic test guard, not an atomic global reservation.
    const issues = await github.paginate(github.rest.issues.listForRepo,{owner,repo,state:'all',per_page:100});
    const duplicates = issues.filter(i =>
      i.number < issue_number && i.user && i.user.login===trusted &&
      /^\[CYBERTRON (SOURCE|DRAFT)\] /.test(i.title || '') &&
      (i.title || '').endsWith(' '+id)
    );
    if (duplicates.length) {
      await stop('BLOCKED','Duplicate ID; canonical issue #'+Math.min(...duplicates.map(i=>i.number))); return;
    }

    // The issue body is only an opaque pointer. All executable instructions
    // come from a repo-owner commit on main, never from an editable issue.
    const authorizationPath = 'recovery/authorizations/'+id+'_ISSUE-'+issue_number+'.json';
    const authCommit = (await github.rest.repos.getCommit({owner,repo,ref:auth_commit})).data;
    const commitFiles = authCommit.files || [];
    if (!authCommit.author || authCommit.author.login!==trusted ||
        commitFiles.length!==1 || commitFiles[0].filename!==authorizationPath ||
        commitFiles[0].status!=='added' ||
        !(await checkAuthorizationAncestry(auth_commit))) {
      await stop('BLOCKED','Authorization commit is not an owner-authored, single-manifest commit on main'); return;
    }
    const authFile = (await github.rest.repos.getContent({owner,repo,path:authorizationPath,ref:auth_commit})).data;
    if (Array.isArray(authFile) || authFile.type!=='file') {
      await stop('BLOCKED','Authorization file not a regular file'); return;
    }
    let order;
    try { order = JSON.parse(Buffer.from(authFile.content,'base64').toString('utf8')); }
    catch (_) { await stop('BLOCKED','Invalid manifest JSON'); return; }
    const expectedKeys = [
      'acceptance','expected_source_sha','id','issue_number','production_release',
      'requester','scope','target_branch','target_path','target_repository',
      'task_type','test_delay_seconds','version','worker'
    ].sort();
    const exact = order && !Array.isArray(order) &&
      JSON.stringify(Object.keys(order).sort())===JSON.stringify(expectedKeys) &&
      order.version==='0.3' && order.id===id && order.issue_number===issue_number &&
      order.requester===trusted && order.worker==='cybertron-source-v0.3' &&
      order.task_type==='replace-isolated-dispatch-greeting' &&
      order.target_repository===owner+'/'+repo && order.target_branch===branch &&
      order.target_path===path && order.expected_source_sha===beforeSha &&
      order.scope==='single-line-fixed-literal' && order.acceptance===acceptance &&
      order.production_release===false && [0,45].includes(order.test_delay_seconds);
    if (!exact) { await stop('BLOCKED','Manifest violates exact task, target, scope, or acceptance allowlist'); return; }

    let live = await checkLive(first.body);
    if (live.closed) { await receipt('CANCELLED',{reason:'Issue closed before pickup'}); return; }
    if (live.altered || live.titleChanged) { await stop('BLOCKED','Issue changed after authorization validation'); return; }

    await comment(claimPrefix,{id,authorization_commit:auth_commit,status:'CLAIMED',run_id});
    await comment(statusPrefix,{id,status:'RUNNING',authorization_commit:auth_commit,run_id,committed:false});
    if (order.test_delay_seconds===45)
      await new Promise(resolve=>setTimeout(resolve,45000));

    live = await checkLive(first.body);
    if (live.closed) { await receipt('CANCELLED',{reason:'Issue closed during precommit execution; no source write'}); return; }
    if (live.altered || live.titleChanged || !(await checkAuthorizationAncestry(auth_commit))) {
      await stop('BLOCKED','Authorization or issue changed after claim; no source write'); return;
    }

    const sourceFile = (await github.rest.repos.getContent({owner,repo,path,ref:branch})).data;
    if (Array.isArray(sourceFile) || sourceFile.type!=='file' || sourceFile.sha!==beforeSha) {
      observed_source_sha = sourceFile.sha || null;
      await stop('BLOCKED','Test target changed from exact authorized baseline'); return;
    }
    const source = Buffer.from(sourceFile.content,'base64').toString('utf8');
    if (source.split(beforeLiteral).length!==2 || source.includes(afterLiteral)) {
      await stop('BLOCKED','Unexpected test source; deterministic one-line replacement refused'); return;
    }
    const changed = source.replace(beforeLiteral,afterLiteral);
    const replacementCount = (changed.match(/Systems ready\./g) || []).length;
    if (replacementCount!==1 || changed.split('\n').length!==source.split('\n').length) {
      await stop('BLOCKED','Source diff is not exactly the allowed literal replacement'); return;
    }

    // Execute Node's test runner against the actual post-change source, locally,
    // before touching any Git ref. The tests themselves are fixed in this worker.
    const fs = require('node:fs');
    const os = require('node:os');
    const pathLib = require('node:path');
    const child = require('node:child_process');
    const crypto = require('node:crypto');
    const temp = fs.mkdtempSync(pathLib.join(os.tmpdir(),'cyb-source-v03-'));
    const targetFile = pathLib.join(temp,'dispatch-target.cjs');
    const testFile = pathLib.join(temp,'dispatch-target.test.cjs');
    const testCode = [
      "'use strict';",
      "const test=require('node:test');",
      "const assert=require('node:assert/strict');",
      "const {dispatchGreeting}=require('./dispatch-target.cjs');",
      "test('empty greeting is updated',()=>assert.equal(dispatchGreeting(), 'Systems ready.'));",
      "test('blank greeting is updated',()=>assert.equal(dispatchGreeting('  '), 'Systems ready.'));",
      "test('named greeting remains unchanged',()=>assert.equal(dispatchGreeting(' Echo '), 'Ready, Echo.'));",
      "test('non-string greeting uses safe default',()=>assert.equal(dispatchGreeting(null), 'Systems ready.'));"
    ].join('\n')+'\n';
    try {
      fs.writeFileSync(targetFile,changed,'utf8');
      fs.writeFileSync(testFile,testCode,'utf8');
      const check = child.spawnSync(process.execPath,['--check',targetFile],{encoding:'utf8',timeout:15000});
      const testRun = child.spawnSync(process.execPath,['--test',testFile],{encoding:'utf8',timeout:30000});
      tests = {status:check.status===0 && testRun.status===0?'PASS':'FAIL',
        syntax_exit:check.status, node_test_exit:testRun.status,
        test_summary:(testRun.stdout || '').slice(-2400), stderr:(check.stderr || testRun.stderr || '').slice(-900)};
    } finally {
      fs.rmSync(temp,{recursive:true,force:true});
    }
    if (tests.status!=='PASS') { await stop('FAILED','Node syntax or behavior test failed; no source write'); return; }

    live = await checkLive(first.body);
    if (live.closed) { await receipt('CANCELLED',{reason:'Issue closed after tests, before source write'}); return; }
    if (live.altered || live.titleChanged || !(await checkAuthorizationAncestry(auth_commit))) {
      await stop('BLOCKED','Issue or authorization changed before source write'); return;
    }

    // The contents API requires the previously authorized blob SHA (CAS).
    // Racing/replayed commits against that file fail without a second write.
    const write = await github.rest.repos.createOrUpdateFileContents({
      owner,repo,path,branch,sha:beforeSha,
      message:'CYBERTRON '+id+': isolated source greeting verification',
      content:Buffer.from(changed,'utf8').toString('base64')
    });
    committed = true;
    source_commit = write.data.commit.sha;
    changed_files = [path];
    const newBlobSha = crypto.createHash('sha1')
      .update('blob '+Buffer.byteLength(changed,'utf8')+'\0'+changed).digest('hex');
    observed_source_sha = newBlobSha;

    // Read back remote content AND the Git commit's changed-file list.
    const remote = (await github.rest.repos.getContent({owner,repo,path,ref:source_commit})).data;
    const diff = (await github.rest.repos.getCommit({owner,repo,ref:source_commit})).data;
    const remoteValue = Buffer.from(remote.content,'base64').toString('utf8');
    if (remote.sha!==newBlobSha || remoteValue!==changed ||
        diff.files.length!==1 || diff.files[0].filename!==path ||
        diff.files[0].status!=='modified') {
      await receipt('FAILED_AFTER_COMMIT',{reason:'Committed source readback or one-file diff mismatch',observed_commit_files:diff.files.map(f=>f.filename)});
      core.setFailed('Postcommit verification mismatch; NO rollback implied'); return;
    }
    const finalIssue = await current();
    await receipt(finalIssue.state==='open'?'COMPLETE':'COMPLETE_CANCEL_REQUESTED',{
      reason:finalIssue.state==='open'?
        'Source committed; Node tests passed; one-file commit read back':
        'Cancellation observed AFTER source commit; no rollback attempted',
      cancel_requested:finalIssue.state!=='open',
      commit_url:write.data.commit.html_url,
      changed_file_diff:"-const EMPTY_GREETING = 'Ready.';\n+const EMPTY_GREETING = 'Systems ready.';"
    });
  } catch (error) {
    core.error('CYBERTRON_SOURCE_EXCEPTION '+String(error && error.message || error));
    try { await receipt(committed?'FAILED_AFTER_COMMIT':'FAILED',{reason:'Worker exception; '+String(error && error.message || error).slice(0,250)}); }
    catch (receiptError) { core.error('RECEIPT_WRITE_FAILED '+String(receiptError)); }
    core.setFailed('Source worker failed; inspect issue and target branch before retry');
  }
};

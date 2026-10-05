'use strict';

const crypto = require('node:crypto');

const RECEIPT_PREFIX = 'CYBERTRON_ROLE_RECEIPT_V0.1 ';
const MARKER = '<!-- CYBERTRON-ROLE-WO-V0.1 ';
const END = ' -->';
const TRUSTED_REQUESTER = 'VeritasDesign';
const ROLE_TARGETS = Object.freeze({
  MATRIX: 'research-runtime-required',
  FACTORY: 'bounded-worker-match-required',
  ASTRA: 'research-runtime-required'
});

function titleRole(title) {
  const m = /^(MATRIX|FACTORY|ASTRA)\s+—\s+.+$/.exec(title || '');
  return m ? m[1] : null;
}

function parseContract(body) {
  if (typeof body !== 'string') return null;
  const a = body.indexOf(MARKER);
  if (a < 0) return null;
  const b = body.indexOf(END, a + MARKER.length);
  if (b < 0) return null;
  if (body.indexOf(MARKER, a + MARKER.length) !== -1) return null;
  try {
    return JSON.parse(body.slice(a + MARKER.length, b));
  } catch {
    return null;
  }
}

function canonicalContract(contract) {
  return JSON.stringify(contract, Object.keys(contract).sort());
}

function contractSha256(contract) {
  return crypto.createHash('sha256').update(canonicalContract(contract)).digest('hex');
}

function validateContract(issue, contract) {
  const role = titleRole(issue?.title);
  if (!role) return {ok:false, reason:'unroutable_title'};
  if (issue?.user?.login !== TRUSTED_REQUESTER) return {ok:false, reason:'requester_not_allowlisted'};
  if (!contract || Array.isArray(contract) || typeof contract !== 'object') return {ok:false, reason:'missing_or_invalid_contract'};

  const expectedKeys = ['acceptance','authority','deploy','id','production_write','role','scope','task_class','version'].sort();
  if (JSON.stringify(Object.keys(contract).sort()) !== JSON.stringify(expectedKeys)) {
    return {ok:false, reason:'contract_schema_invalid'};
  }
  const valid =
    contract.version === '0.1' &&
    /^CYB-ROLE-[0-9]{3,6}$/.test(contract.id || '') &&
    contract.role === role &&
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(contract.task_class || '') &&
    typeof contract.scope === 'string' && contract.scope.length >= 1 && contract.scope.length <= 160 &&
    ['read-only','bounded-write'].includes(contract.authority) &&
    contract.production_write === false &&
    contract.deploy === false &&
    typeof contract.acceptance === 'string' && contract.acceptance.length >= 1 && contract.acceptance.length <= 300;
  return valid ? {ok:true, role} : {ok:false, reason:'contract_values_not_allowlisted'};
}

async function run({github, context, core}) {
  const issue = context.payload.issue;
  const role = titleRole(issue?.title);
  if (!role) {
    core.info('CYBERTRON_ROLE_ROUTER_IGNORE title');
    return;
  }

  const contract = parseContract(issue.body);
  const validation = validateContract(issue, contract);
  const owner = context.repo.owner, repo = context.repo.repo, issue_number = issue.number;
  const post = body => github.rest.issues.createComment({owner, repo, issue_number, body});

  if (!validation.ok) {
    await post(RECEIPT_PREFIX + JSON.stringify({
      version:'0.1', status:'BLOCKED', issue_number,
      role, id:contract?.id || 'UNKNOWN', blocker:validation.reason,
      router_run:context.runId, execution_authority:'NONE'
    }));
    core.setFailed('CYBERTRON_ROLE_ROUTER BLOCKED: ' + validation.reason);
    return;
  }

  const digest = contractSha256(contract);
  const comments = await github.paginate(github.rest.issues.listComments,{owner,repo,issue_number,per_page:100});
  const prior = comments.filter(c => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(RECEIPT_PREFIX));
  for (const c of prior) {
    try {
      const r = JSON.parse(c.body.slice(RECEIPT_PREFIX.length));
      if (r.id === contract.id && r.contract_sha256 === digest && r.status === 'BLOCKED') {
        core.info('CYBERTRON_ROLE_ROUTER_DUPLICATE_SKIP ' + contract.id);
        return;
      }
    } catch {}
  }

  const receipt = {
    version:'0.1',
    status:'ROUTED',
    id:contract.id,
    issue_number,
    role:contract.role,
    task_class:contract.task_class,
    scope:contract.scope,
    authority:contract.authority,
    production_write:false,
    deploy:false,
    acceptance:contract.acceptance,
    contract_sha256:digest,
    next_worker:ROLE_TARGETS[contract.role],
    router_run:context.runId,
    source_issue_url:issue.html_url,
    execution_authority:'NONE',
    note:'Router receipt acknowledges durable pickup only; it does not claim task execution.'
  };
  await post(RECEIPT_PREFIX + JSON.stringify(receipt));
  core.info('CYBERTRON_ROLE_ROUTED ' + JSON.stringify(receipt));
}

module.exports = { run, titleRole, parseContract, validateContract, contractSha256, RECEIPT_PREFIX };

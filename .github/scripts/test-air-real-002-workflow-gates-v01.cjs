'use strict';
// Static workflow integration qualification; no credentials, network, or external writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const workflow=fs.readFileSync('.github/workflows/cybertron-airtable-ready-dispatcher-v02.yml','utf8');
const proof=fs.readFileSync('.github/scripts/air-real-002-terminal-proof-v01.cjs','utf8');
const terminal=workflow.indexOf('name: Verify historical completion BEFORE obsolete source preflight (read only)');
const preflight=workflow.indexOf('name: Preflight cross-repo capability and exact target');
const claim=workflow.indexOf('name: Claim exact READY work order');
const build=workflow.indexOf('name: Build bounded desktop-only fix and PR');
const completion=workflow.indexOf('name: Persist completion only after PR evidence');
assert(terminal>0&&terminal<preflight&&preflight<claim&&claim<build&&build<completion,'TERMINAL_ORDER');
assert(workflow.includes('id: terminal'),'TERMINAL_OUTPUT_ID');
for(const name of ['Preflight cross-repo capability and exact target','Claim exact READY work order','Build bounded desktop-only fix and PR','Persist completion only after PR evidence']){
  const start=workflow.indexOf('- name: '+name);
  const block=workflow.slice(start,workflow.indexOf('\n      - name:',start+1)>0?workflow.indexOf('\n      - name:',start+1):undefined);
  assert(block.includes("if: steps.terminal.outputs.terminal_verified != 'true'"),'UNGATED_'+name);
}
assert(workflow.includes('concurrency:\n  group: cybertron-air-real-002-exact-target'),'NO_WORKFLOW_CONCURRENCY');
assert(proof.includes("req(airtable,'GET')"),'NO_READBACK');
assert(!/req\([^\n]*'PATCH'|req\([^\n]*'POST'/.test(proof),'UNEXPECTED_TERMINAL_WRITE');
assert(proof.includes("HISTORIC_ORDER_NOT_TERMINAL"),'NONTERMINAL_NOT_CLOSED');
assert(proof.includes("terminal_verified=true"),'MISSING_TERMINAL_SIGNAL');
console.log('AIR_REAL_002_WORKFLOW_GATE_PASS 4 execution paths gated, terminal preflight first, read-only source');

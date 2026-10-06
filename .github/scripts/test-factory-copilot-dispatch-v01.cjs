'use strict';
const assert=require('assert/strict');
const d=require('./factory-copilot-dispatch-v01.cjs');

const classes=[
  'sentinel-v021-forecast-coordinate-fix',
  'sentinel-real-first-map',
  'sentinel-usgs-earthquakes',
  'sentinel-swpc-aurora',
  'sentinel-nwps-water'
];
assert.deepEqual(Object.keys(d.CAPABILITIES),classes);
for(const [task,cap] of Object.entries(d.CAPABILITIES)){
  assert.equal(cap.targetRepo,'VeritasDesign/free-frequency-genie-lab');
  assert.equal(cap.baseBranch,'factory-sentinel-v021-make-home-real');
  assert.match(cap.instructions,/Do not deploy/i);
}
assert.equal(d.CAPABILITIES['sentinel-v021-forecast-coordinate-fix'].prerequisiteIssue,null);
assert.equal(d.CAPABILITIES['sentinel-real-first-map'].prerequisiteIssue,95);
assert.equal(d.CAPABILITIES['sentinel-usgs-earthquakes'].prerequisiteIssue,96);
assert.equal(d.CAPABILITIES['sentinel-swpc-aurora'].prerequisiteIssue,97);
assert.equal(d.CAPABILITIES['sentinel-nwps-water'].prerequisiteIssue,98);

const issue={number:95};
const good={
  version:'0.1',status:'ROUTED',role:'FACTORY',
  authority:'bounded-write',production_write:false,deploy:false,
  execution_authority:'NONE',issue_number:95,
  task_class:'sentinel-v021-forecast-coordinate-fix',id:'CYB-ROLE-095'
};
assert.equal(d.validReceipt(good,issue),true);
for(const [field,value] of [
  ['role','ASTRA'],['authority','read-only'],['production_write',true],
  ['deploy',true],['execution_authority','WRITE'],['issue_number',96],
  ['task_class','unsupported']
]){
  assert.equal(d.validReceipt({...good,[field]:value},issue),false,'must reject '+field);
}
const payload=d.assignmentPayload(good);
assert.deepEqual(payload.assignees,['copilot-swe-agent[bot]']);
assert.equal(payload.agent_assignment.target_repo,'VeritasDesign/free-frequency-genie-lab');
assert.equal(payload.agent_assignment.base_branch,'factory-sentinel-v021-make-home-real');
assert.match(payload.agent_assignment.custom_instructions,/Do not deploy/i);

assert.equal(d.hasBuilderAssignment([{body:d.ASSIGN_PREFIX+JSON.stringify({id:'CYB-ROLE-095',status:'ASSIGNED'})}],'CYB-ROLE-095'),true);
assert.equal(d.hasBuilderAssignment([],'CYB-ROLE-095'),false);
assert.equal(d.hasTerminalExecution([{body:'X {"id":"CYB-ROLE-095","status":"COMPLETE"}'}],'CYB-ROLE-095'),true);
assert.equal(d.hasTerminalExecution([{body:'X {"id":"CYB-ROLE-095","status":"MATCHED"}'}],'CYB-ROLE-095'),false);
assert.equal(d.acceptedPrerequisite([{body:d.RESULT_PREFIX+JSON.stringify({issue_number:95,status:'ACCEPTED'})}],95),true);
assert.equal(d.acceptedPrerequisite([{body:d.RESULT_PREFIX+JSON.stringify({issue_number:95,status:'REJECTED'})}],95),false);


const fs=require('fs');
const workflow=fs.readFileSync('.github/workflows/cybertron-factory-bounded-dispatch-v01.yml','utf8');
assert.match(workflow,/FACTORY_BUILDER_USER_TOKEN/);
assert.match(workflow,/missing_FACTORY_BUILDER_USER_TOKEN/);
assert.match(workflow,/authorization:'Bearer '\+builderToken/);
assert.doesNotMatch(workflow,/authorization:'Bearer '\+process\.env\.GITHUB_TOKEN/);

console.log('Factory Copilot builder dispatch gates PASS');

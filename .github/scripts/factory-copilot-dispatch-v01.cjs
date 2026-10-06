'use strict';

const BUILDER = 'copilot-swe-agent[bot]';
const ASSIGN_PREFIX = 'FACTORY_BUILDER_ASSIGNMENT_V0.1 ';
const RESULT_PREFIX = 'FACTORY_BUILDER_RESULT_V0.1 ';

const CAPABILITIES = Object.freeze({
  'sentinel-v021-forecast-coordinate-fix': Object.freeze({
    issueNumber: 95,
    targetRepo: 'VeritasDesign/free-frequency-genie-lab',
    baseBranch: 'factory-sentinel-v021-make-home-real',
    prerequisiteIssue: null,
    instructions: [
      'Factory bounded Builder task. Work only on the Sentinel V0.2.1 candidate.',
      'Fix only official-zone-derived forecast coordinate precision so lat/lon satisfy the existing <=6-decimal transport contract.',
      'Add focused regression coverage and run the existing Sentinel V0.2.1 tests.',
      'Do not deploy. Do not modify production aliases, Vercel settings, secrets, unrelated workflows, or unrelated application behavior.',
      'Open a pull request back to base branch factory-sentinel-v021-make-home-real and report exact changed files and tests.'
    ].join(' ')
  }),
  'sentinel-real-first-map': Object.freeze({
    issueNumber: 96,
    targetRepo: 'VeritasDesign/free-frequency-genie-lab',
    baseBranch: 'factory-sentinel-v021-make-home-real',
    prerequisiteIssue: 95,
    instructions: [
      'Factory bounded Builder task. Make Sentinel real-first and easier to understand.',
      'Default map must show real data/official watched-area context; synthetic fixtures must require an explicit Demo/Samples mode.',
      'Keep Home attention-first, preserve Explain This/provenance, preserve no-device-geolocation.',
      'Run relevant tests and add focused coverage for real-vs-sample separation.',
      'Do not deploy or modify production infrastructure. Open a pull request to factory-sentinel-v021-make-home-real.'
    ].join(' ')
  }),
  'sentinel-usgs-earthquakes': Object.freeze({
    issueNumber: 97,
    targetRepo: 'VeritasDesign/free-frequency-genie-lab',
    baseBranch: 'factory-sentinel-v021-make-home-real',
    prerequisiteIssue: 96,
    instructions: [
      'Factory bounded Builder task. Add an official USGS earthquake read-only adapter to the Sentinel candidate.',
      'Preserve source timestamps, magnitude, coordinates, depth, place text and source identity when supplied.',
      'Fail closed on upstream/schema errors; never relabel fixture data as real; no device geolocation.',
      'Integrate only with the real map/evidence model and add tests.',
      'Do not deploy. Open a pull request to factory-sentinel-v021-make-home-real.'
    ].join(' ')
  }),
  'sentinel-swpc-aurora': Object.freeze({
    issueNumber: 98,
    targetRepo: 'VeritasDesign/free-frequency-genie-lab',
    baseBranch: 'factory-sentinel-v021-make-home-real',
    prerequisiteIssue: 97,
    instructions: [
      'Factory bounded Builder task. Add official NOAA SWPC/OVATION read-only aurora/space-weather data.',
      'Clearly label official/real source data and never imply exact local visibility without supporting darkness/cloud/location evidence.',
      'Keep wonder separate from warnings and synthetic aurora only in Demo/Samples mode.',
      'Fail closed, add tests, preserve no-device-geolocation.',
      'Do not deploy. Open a pull request to factory-sentinel-v021-make-home-real.'
    ].join(' ')
  }),
  'sentinel-nwps-water': Object.freeze({
    issueNumber: 99,
    targetRepo: 'VeritasDesign/free-frequency-genie-lab',
    baseBranch: 'factory-sentinel-v021-make-home-real',
    prerequisiteIssue: 98,
    instructions: [
      'Factory bounded Builder task. Add official NOAA NWPS read-only water/river information to Sentinel.',
      'Preserve source timestamps and flood-category/impact text when supplied; do not infer exact personal exposure from area/gage data.',
      'Fail closed on upstream/schema errors and never present synthetic fallback as real.',
      'Integrate with the real map/evidence model and add tests; preserve no-device-geolocation.',
      'Do not deploy. Open a pull request to factory-sentinel-v021-make-home-real.'
    ].join(' ')
  })
});

function validReceipt(r, issue) {
  return !!r &&
    r.version === '0.1' &&
    r.status === 'ROUTED' &&
    r.role === 'FACTORY' &&
    r.authority === 'bounded-write' &&
    r.production_write === false &&
    r.deploy === false &&
    r.execution_authority === 'NONE' &&
    Number(r.issue_number) === Number(issue.number) &&
    typeof r.task_class === 'string' &&
    !!CAPABILITIES[r.task_class] &&
    CAPABILITIES[r.task_class].issueNumber === issue.number;
}

function assignmentPayload(r) {
  const cap = CAPABILITIES[r.task_class];
  if (!cap) throw new Error('unsupported task class');
  return {
    assignees: [BUILDER],
    agent_assignment: {
      target_repo: cap.targetRepo,
      base_branch: cap.baseBranch,
      custom_instructions: cap.instructions
    }
  };
}

function parseReceipt(body, prefix) {
  if (!body || !body.startsWith(prefix)) return null;
  try { return JSON.parse(body.slice(prefix.length)); } catch { return null; }
}

function hasBuilderAssignment(comments, id) {
  return comments.some(c => {
    const x = parseReceipt(c.body, ASSIGN_PREFIX);
    return x && x.id === id && x.status === 'ASSIGNED';
  });
}

function hasTerminalExecution(comments, id) {
  return comments.some(c => {
    const body = c.body || '';
    if (!body.includes('"id":"'+id+'"')) return false;
    if (body.startsWith(ASSIGN_PREFIX)) return false;
    return body.includes('"status":"CLAIMED"') ||
      body.includes('"status":"COMPLETE"') ||
      body.includes('"status":"CANCELLED"') ||
      body.includes('"status":"BLOCKED"');
  });
}

function acceptedPrerequisite(comments, issueNumber) {
  return comments.some(c => {
    const x = parseReceipt(c.body, RESULT_PREFIX);
    return x && Number(x.issue_number) === Number(issueNumber) && x.status === 'ACCEPTED';
  });
}

module.exports = {
  BUILDER,
  ASSIGN_PREFIX,
  RESULT_PREFIX,
  CAPABILITIES,
  validReceipt,
  assignmentPayload,
  parseReceipt,
  hasBuilderAssignment,
  hasTerminalExecution,
  acceptedPrerequisite
};

# Chief → Factory Dispatch Bridge v0.1

State: infrastructure candidate; NOT ACTIVATED / NOT OPERATIONAL.
Repository: VeritasDesign/free-frequency-genie-lab. Recovered main: 80759376a0f44e5ba702a7927b5ba4c5e404d81c.

## Scope and trust

Chief transports an explicitly authorized request into the existing Airtable Work Orders mailbox. Factory alone executes the installed deterministic read-only worker. Chief independently reads the durable receipt and GitHub/source evidence. No arbitrary agent/code/shell runner, new credentials, target repository, paid API, notification, product merge or deployment is introduced.

This PR adds no schedule. The optional manual workflow is main-only, and its consumer_enabled=false / authorization=null gates prevent any live mailbox access. PR jobs are offline only, with no secrets. Adding a cron, enabling the manifest, and admitting/submitting the exact canary require Shannon's next explicit activation authorization. This build approval does not authorize those steps.

Main repository code and admission manifest are trusted policy. Requests and mailbox text are untrusted. approved_by=Shannon is not a signature; a repository-maintained exact approval reference, digest and expiry must be populated only after a recoverable explicit Shannon approval. That trust assumption requires review of any activation diff. Connector access or existing token scope never substitutes for authorization.

## Exact proposed canary

| Field | Value |
|---|---|
| Contract | chief-factory-read-checkpoint-v01 |
| Immutable digest | 65a1c6c55bddfcfb11273d26efdbffed545bfa8b693d64478e7619db64e0d8a2 |
| Work order | AIR-BRIDGE-001 |
| Correlation | AIR-BRIDGE-001-CHIEF-1 |
| Attempt | AIR-BRIDGE-001-DISPATCH-1 |
| Worker/task | repository-checkpoint-v01 / read-only-repository-checkpoint |
| Target/base | VeritasDesign/free-frequency-genie-lab / main |
| Pinned source commit | 80759376a0f44e5ba702a7927b5ba4c5e404d81c |
| READY Dispatcher v0.2 source blob | 95c031746c29d329f2d049b0cf5cce0b6658e456 |
| Sentinel Dispatcher source blob | 5cc5e89723fd99b8920babbcbcaa16052f16757c |
| Authority | READ_ONLY; production_write/deploy/merge/branch_pr/paid_services all false |
| Parameters/prerequisites | Empty; no executable text |
| Current approval | None; authorization=null |

The worker confirms pinned commit/blob identities and that the pinned source is an ancestor of main before executable work. It emits a deterministic checkpoint JSON and SHA-256. Infrastructure activation will move main, so the pinned historical source is checked by ancestry, not by requiring main HEAD to remain old. No target file modification, product branch or PR is part of this canary. Historical real-work run URLs are evidence references, not execution inputs. The proposed request file contains non-executable placeholders for authorization reference and creation time; never publish it READY as-is.

## Chief transport adapter contract

The exported submit(manifest,request,db,now) adapter stages AWAITING_APPROVAL, independently reads the record, checks complete immutable identity, repeats duplicate lookup, publishes READY and reads back APPLY. It never claims or executes. Replay returns the existing attempt state without resetting it. Concurrent staging duplicates are rejected and remain non-executable.

The db interface is list() → all {id,fields} records, read(id), create(fieldId-keyed values), patch(id,fieldId-keyed values). REST-backed implementation is supplied for Factory. In a connected Chief session, implement those four methods with the existing Airtable connector operations; normalize cellValuesByFieldId to fields and single-select values to their name before validation. Exhaust pagination; never silently truncate. No external token is needed or exposed to Chief. Existing connector access suffices for the authorized transport, but no live submission occurs in this build.

Use the checked-in verified field IDs and types in airtable-schema-2026-10-07.json. All writes have typecast=false; no schema changes. Chief may write only this exact admitted contract's immutable ID/task/payload, initial AWAITING_APPROVAL staging and subsequent READY state. Attempt ID, Claimed By, Result and Receipt belong to Factory. A partial or ambiguous row never becomes READY. Treat failed submission/readback as incomplete transport, never pretend Factory received it.

The request schema permits only schema, work_order_id, correlation_id, contract_id, contract_digest, authorization_ref, task_class, evidence_refs, created_at. It contains no target, command, URL configuration, token or parameters. The immutable contract digest excludes mutable authorization timing/reference, but covers identity, target, worker, authority, parameters, prerequisites and evidence references. The envelope's authorization_ref must match the trusted manifest separately. Exactly one admitted contract is implemented in v0.1. General-purpose job submission remains unsupported.

## Factory lifecycle and recovery

Consumer is serialized with cancel-in-progress=false. It scans only AIR-BRIDGE- namespace rows and validates the full bridge batch before writes. Duplicate IDs anywhere in the full mailbox, unsupported bridge rows and ambiguous execution block admission. Existing AIR-REAL-* and AIR-SENTINEL-* records are not changed.

READY → source/approval preflight → CLAIMED → independent claim readback → duplicate/claim recheck → installed read-only worker → durable BUILT checkpoint → independent checkpoint readback → artifact upload → durable pending COMPLETE receipt → independent readback → COMPLETE → independent readback.

Retry uses the fixed Attempt ID. A durable BUILT checkpoint reuses identical output without worker execution; interruption before checkpoint persistence may repeat a harmless read-only worker. A pending COMPLETE receipt finalizes status without rebuilding or uploading another artifact. A lost completion response yields terminal replay. Executable resumes still require current authorization; expiry blocks them without resetting identity. Terminal replay verifies original identity/receipt, not current source conditions, expiry or Next Action. This corrects the recovered mutable Next Action validation defect in the new bridge without modifying old dispatchers.

Artifact upload before pending receipt persistence may be repeated after failure. No exactly-once artifact-upload claim is made. The v0.1 worker creates no product branch/PR, so product-PR reuse is not applicable; adding a build-capable contract later requires a separately scoped trusted worker and duplicate-PR proof.

## Independent receipt retrieval

retrieve(manifest,recordId,expectedRequest,db,github,now) performs fresh record and full-mailbox uniqueness reads, checks expected correlation/contract/attempt and COMPLETE receipt/output digest, verifies GitHub run + artifact metadata, requires a successful completed consumer run, then independently fetches the pinned source identities to compare the output. It performs no writes and returns VERIFIED_COMPLETE only on these checks.

Runtime CLI: propose (offline template); consume (closed-gate no-op until explicitly activated); complete (Factory only); retrieve RECORD_ID EXPECTED_REQUEST_JSON (read-only with existing runtime read access). The exported adapter is used with existing connectors in Chief sessions. Chief can use the GitHub connector to read the named run/artifact metadata and pinned source blobs, without obtaining runtime AIRTABLE_TOKEN or GITHUB_TOKEN. Receipt remains retrievable after the active chat ends; automatic unsolicited push-to-chat is not implemented.

The receipt contains work/correlation/contract/auth/attempt identity, worker origin run, artifact upload run, artifact ID/digest, output/output digest and false consequence gates. It contains no credentials. Evidence artifact expires after 30 days; retrieval then fails closed on expired artifact even though the durable checkpoint remains in Airtable. Archive verified evidence separately before expiry if retention is later authorized.

## Offline acceptance

Run node --test --test-reporter=tap .github/scripts/test-chief-factory-dispatch-v01.cjs and node --check .github/scripts/chief-factory-dispatch-v01.cjs.

Coverage: staged-positive lifecycle and independent retrieval; unsupported task/contract/worker; wrong repo/base/source/blob; missing/stale/foreign approvals; malformed and mutated requests; all consequence gate escalations; shell/token/URL configuration injection; duplicate and concurrent staging; unknown batch member; preserved historical records; foreign claims; drift-before-claim; claim/checkpoint/receipt interruptions before and after persistence; same-attempt resume; checkpoint/output reuse; terminal replay/resubmission after mutable progress or expiry; terminal/checkpoint mismatch; independent run/artifact/source checks; staging readback corruption; REST pagination/error/redirect rules; closed workflow gates.

The fixture's activation approval is explicitly offline-only and never saved to the manifest or live mailbox. Passing mocks proves deterministic boundary behavior, not live connector transport or a scheduled consumer. Existing product/dispatch files are not modified by this PR.

## Remaining risks and activation gate

- Airtable has no atomic compare-and-swap or unique constraint here. Serialized consumer and repeated full-table duplicate/claim checks reduce race risk; unrelated concurrent external writers can still race after the last check. V0 requires the adapter as the sole bridge writer and fails on observed ambiguity. It does not promise mathematically exactly-once execution.
- Trusted manifest changes require reviewed explicit authorization; names/ref strings alone are not cryptographic human approval.
- Only one exact read-only canary contract is installed. This is a bridge proof, not arbitrary software-build automation.
- Runtime permissions are GitHub contents:read + actions:read for source and evidence metadata; no write permissions or new credentials. The existing AIRTABLE_TOKEN remains in Factory only. Its provider-level scope is not changed or independently enumerated by this PR.
- Live connector binding, network permissions, Actions artifact behavior and cron timing remain unproven until activation. The current workflow has no cron.
- No automatic push into an ended Chief chat and no notification channel exists.
- Old real-work dispatchers and their historical validator failures are preserved; this PR does not silently repair or reexecute them.

Stop here: review infrastructure PR and exact canary, then obtain Shannon's explicit activation/submission authorization. No infrastructure merge, activation, canary submission or product/production consequence is performed by this build order.

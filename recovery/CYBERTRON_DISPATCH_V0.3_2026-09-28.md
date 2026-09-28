# Cybertron dispatch v0.3 — 2026-09-28

Continuation of [v0.2](CYBERTRON_DISPATCH_V0.2_2026-09-28.md); do not replace or weaken that checkpoint. Public GitHub Issues queue: never place secrets, personal data, private project instructions, or credentials into orders, comments, or receipts.

## Executive receipt — real source work PROVEN

**Work order:** CYB-SRC-001, [issue #14](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/14).
**Authorization:** owner-authored, main-reachable manifest commit `e590f2f67bdd7313be24fff7c0d97d8c34320d2f`; manifest `recovery/authorizations/CYB-SRC-001_ISSUE-14.json`. The issue body contained only the pinned authorization SHA.
**Worker:** [`.github/workflows/cybertron-source-v03.yml`](../.github/workflows/cybertron-source-v03.yml), source [`.github/scripts/cybertron-source-v03.cjs`](../.github/scripts/cybertron-source-v03.cjs). Workflow install commit `28d9b0452b4fc5dd520a317fd41ac8741accc296`; worker source commit `ba95e52182c54df3d17010bd9e3422c23c6163eb`.
**GitHub Actions run:** [36378803338](https://github.com/VeritasDesign/free-frequency-genie-lab/actions/runs/36378803338).
**Committed source:** [`6be6ab364025110d7953a70207a8a6fd3d6a4a1b`](https://github.com/VeritasDesign/free-frequency-genie-lab/commit/6be6ab364025110d7953a70207a8a6fd3d6a4a1b) on the NON-PRODUCTION branch `cybertron-v03-isolated`.
**Exactly one source file changed:** `sandbox/dispatch-target.cjs`. GitHub's commit file list and source content independently read back.
```diff
-const EMPTY_GREETING = 'Ready.';
+const EMPTY_GREETING = 'Systems ready.';
```
**Verification:** Node syntax check exit 0; Node test runner exit 0; four named behavioral tests passed, zero failures. Source preimage blob `ba27e3f685cac94b609d2fa8ea067436a416da79`; resulting blob `72f8bbd08752dc6aa1e5716f64838c0779f0ae88`.
**Receipt:** bot-authored `CYBERTRON_SOURCE_RECEIPT_V0.3` on issue #14, status `COMPLETE`, `committed:true`, `production_release:false`. Echo retrieved it directly using the connected GitHub issue-comments tool. No Shannon status relay was required.

## Implementation and boundaries

- Original [`.github/workflows/cybertron-dispatch.yml`](../.github/workflows/cybertron-dispatch.yml) is UNCHANGED (blob `4d5af39c97c4a77cb2011a4255e41599547f93cf`), still `contents: read` and `issues: write`, with its strict comment-only test allowlist.
- Separate v0.3 workflow handles only issue titles exactly `[CYBERTRON SOURCE] CYB-SRC-NNN`. The source worker has `issues:write` and `contents:write` **only in this isolated lab repository**. The GITHUB_TOKEN is repository-scoped, NOT GitHub-enforced path-scoped: path and branch restrictions are enforced by reviewed worker code. Never transplant this workflow into a protected app repository.
- This source worker accepts a single task: replacing one fixed literal in `sandbox/dispatch-target.cjs` on `cybertron-v03-isolated`. It checks one fixed preimage blob; the GitHub Contents API's `sha` precondition guards the file write. There is no dynamic command, user-provided patch, arbitrary path, cross-repository write, deployment, API key, or production task.
- Immutable Git commit SHA anchors the manifest. The worker requires that authorization commit to be authored by `VeritasDesign`, reachable from current `main`, and to add exactly one issue-number-specific JSON manifest. It checks the manifest's complete field set and exact requester, issue number, task type, target repository/branch/path, expected blob, scope, acceptance, production-release flag, and test delay. Editable public issue text carries only the commit SHA; after claim, the worker rechecks the issue body/title/state and main reachability before modifying source.
- The main branch is **not branch-protected**; this is commit-pinned, owner-gated authorization for a harmless lab file, **not** a cryptographic signature or a fully protected approver process. A holder of repo write/admin authority can change the worker or main. Scope is narrow by code, not by independent GitHub token path permissions.
- A successful write is verified against remote file bytes and the GitHub commit's one-file diff. If a cancellation is observed after the commit, the implemented receipt path reports `COMPLETE_CANCEL_REQUESTED`, `committed:true`, and no rollback; that postcommit timing branch has NOT received a live cancellation test.

## Live safety test matrix

| Case | Evidence | Observed result | Classification |
| --- | --- | --- | --- |
| Real authorized source edit | [#14](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/14), run 36378803338, source 6be6ab3 | COMPLETE; four Node tests passed; exactly one file changed; bot receipt read back through GitHub | PROVEN |
| Malformed/no authorization | [#9](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/9), run 36378597187 | BLOCKED; no claim, no source commit | PROVEN |
| Forbidden file target `index.html` | [#10](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/10), run 36378629089 | BLOCKED exact-manifest allowlist, no source commit | PROVEN |
| Modified issue authorization before pickup | [#11](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/11), run 36378650056 | BLOCKED malformed pin, no source commit | PROVEN |
| Cancellation before pickup | [#12](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/12), run 36378670479 | CANCELLED; `committed:false`; no claim/source change | PROVEN |
| Cooperative cancellation during precommit execution | [#13](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/13), run 36378686860 | CLAIMED → RUNNING → CANCELLED after issue closure during 45-second precommit delay; `committed:false`; no source change | PROVEN for cooperative precommit only |
| Postclaim issue-body tampering | [#16](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/16), run 36378760427 | CLAIMED → RUNNING → BLOCKED; issue body modified during active delay; `committed:false` | PROVEN |
| Duplicate ID on a second, separately commit-authorized issue | [#15](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/15), run 36378841800 | BLOCKED, canonical issue #14; no source commit | PROVEN for this test |
| Repeated pickup of completed issue | [#14](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/14), repeat run [36378847309](https://github.com/VeritasDesign/free-frequency-genie-lab/actions/runs/36378847309) | Job log `CYBERTRON_SOURCE_TERMINAL_SKIP CYB-SRC-001`; one COMPLETE receipt and one source commit | PROVEN for this test |
| Forbidden different-project target | [#17](https://github.com/VeritasDesign/free-frequency-genie-lab/issues/17), run 36378895619 | BLOCKED target repository outside lab; no source commit | PROVEN |

The issue-body edit on #16 also queued a second issue-edited run (36378775000); it produced a second BLOCKED receipt for malformed authorization. This was not a second source write. Duplicate *receipt* suppression on concurrent malformed/reedited orders is not proven; the observed extra denial is retained in the evidence, not concealed.

The original v0.2 comment-only tests remain as recorded in v0.2. The existing `index.html` blob remained `ea2633ec15fe9f1c6a9c2e5740cc7274776af253`; `pages.yml` remained `d698b19026aa55bc9804dae7d1f9e8ca9b107f12`. No Pages workflow run was found from the v0.3 build changes. No changes were made to the shared production Factory repository or protected applications.

## Capability ledger and honest limits

**PROVEN:** Durable issue queue; original v0.2 comment worker preserved; automatic source-worker pickup; owner/main-commit-pinned lab order validation; one actual isolated source commit; test-before-write and remote readback; issue-bot receipt; Echo's connected GitHub readback; single-file/project denial; edit-after-claim denial; duplicate ID denial in this test; repeated terminal pickup skip; pre-pickup and cooperative precommit cancellation.

**PARTIAL:** Exactly-once overall. Same-issue concurrency, canonical earlier-issue ID check, terminal receipt skip, and expected-blob compare-and-swap are layered safeguards; no global atomic reservation across independent workers, no guaranteed delivery of all GitHub issue events, no automatic resolution of CLAIMED-without-terminal receipts. Two BLOCKED receipts from #16's edit illustrate event duplication. The GITHUB_TOKEN's contents permission is repository-wide, although its **code-level** allowlist is narrow. The pinned manifest verifies main history and account attribution, but main has no branch protection and the commit is not a signed authorization. One-shot fixture is deliberately exhausted by the successful edit.

**BLOCKED BY CURRENT ALLOWLIST:** A second **new** work order against the already changed `sandbox/dispatch-target.cjs` would fail the pinned preimage check. This is deliberate. Do not silently reset the file or expand the worker's authority.

**UNKNOWN / NOT PROVEN:** Live postcommit cancellation receipt path; forced interruption; rollback; arbitrary source changes; other target projects; cross-chat ChatGPT worker invocation; fully protected/cryptographic authorization; production release. No inference of these capabilities from a successful test.

## Exact operator recipe for Echo's NEXT bounded work order

This version supports exactly the fixed one-line lab transformation; it is **not** a general product generator. To run that same permitted transformation on a **new, explicitly approved test cycle**, first obtain authorization to reset the disposable test fixture on `cybertron-v03-isolated` to its original content/blobs. Confirm `sandbox/dispatch-target.cjs` once again has SHA `ba27e3f685cac94b609d2fa8ea067436a416da79`; verify no other files/branches/deployments changed. Do not reset or run merely because an issue appears. Without an authorized reset, STOP with BASELINE_MISMATCH.

1. Using the connected GitHub account with `VeritasDesign` repo write access, pick an unused `CYB-SRC-NNN` ID (e.g. `CYB-SRC-002`) and create a **public** issue in `VeritasDesign/free-frequency-genie-lab` with title `[CYBERTRON DRAFT] CYB-SRC-002`. Use only nonsensitive placeholder body text. Record the returned issue number N.
2. Create exactly ONE new JSON file **on main** at `recovery/authorizations/CYB-SRC-002_ISSUE-N.json`; commit as the authorized GitHub account. Required fields and exact values below; replace only `id` and `issue_number` for the new order, and ensure the expected source SHA is actually the restored preimage:
```json
{
  "version": "0.3",
  "id": "CYB-SRC-002",
  "issue_number": 0,
  "requester": "VeritasDesign",
  "worker": "cybertron-source-v0.3",
  "task_type": "replace-isolated-dispatch-greeting",
  "target_repository": "VeritasDesign/free-frequency-genie-lab",
  "target_branch": "cybertron-v03-isolated",
  "target_path": "sandbox/dispatch-target.cjs",
  "expected_source_sha": "ba27e3f685cac94b609d2fa8ea067436a416da79",
  "scope": "single-line-fixed-literal",
  "acceptance": "empty input returns Systems ready.; named input unchanged; node tests pass",
  "production_release": false,
  "test_delay_seconds": 0
}
```
Here the shown issue number `0` is a **placeholder**, not valid authorization; replace it with actual N. Require an author-attributed, main-reachable commit that ADDS only this manifest. Record its full SHA A.
3. Arm the issue through the connected GitHub `update_issue` action: change title to `[CYBERTRON SOURCE] CYB-SRC-002` and body to the exact single-line `<!-- CYBERTRON-SOURCE-V0.3 auth_commit=A -->`, replacing A with the 40-character SHA. An `issues.edited` event launches the **separate** v0.3 source workflow automatically.
4. Without asking Shannon to relay status, Echo reads `fetch_issue_comments` for issue N using the GitHub connector, filters **github-actions[bot]** comments with `CYBERTRON_SOURCE_CLAIM_V0.3`, `CYBERTRON_SOURCE_STATUS_V0.3`, and `CYBERTRON_SOURCE_RECEIPT_V0.3`, and checks the receipt's `id`, `authorization_commit`, `run_id`, `source_commit`, changed files, tests, `committed`, and status. Use `fetch_workflow_run_jobs` and `fetch_workflow_job_logs` for run verification and `fetch`/ `fetch_file` for independent commit diff/readback.
5. If cancelling before the commit, close the issue; look for a `CANCELLED`, `committed:false` receipt. If cancellation arrives after a commit, verify the source commit and report the observed receipt; do **not** promise rollback. If CLAIMED never gets a terminal receipt, STOP for operator inspection; do not assume safe retry.

Do not add non-public information to this public system. Do not redirect this worker to landing, FREQUENCY/Phenom, HQ, Basket, Justine, another repository, or production. Do not change original comment-only workflow permissions. For any materially different real project task, prepare a separate reviewed and appropriately scoped authorization mechanism instead of editing an order to escape these hardcoded constraints.

**Checkpoint conclusion:** One actual authorized source-code mutation is PROVEN end-to-end; Echo read the bot completion receipt without Shannon relaying it. All wider scope remains bounded by the classifications above. UNKNOWN > invented continuity. Preserve capability; gate consequence.

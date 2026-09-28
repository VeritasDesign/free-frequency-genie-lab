# Cybertron dispatch v0.1 — 2026-09-28

## Proven boundary
Queue: GitHub Issues in VeritasDesign/free-frequency-genie-lab. This is a PUBLIC repository: never put credentials, private data, or sensitive tasks in issue bodies or comments.
Worker: isolated GitHub Actions workflow .github/workflows/cybertron-dispatch.yml, triggered on issue opened only when title starts [CYBERTRON TEST].
Only permitted task type: harmless-receipt-test. Only permitted target: free-frequency-genie-lab/dispatch. Only permitted scope: issue-comments-only. Production release must be false. No arbitrary commands, code edits, deployments, external workers, or cross-chat invocation.

## Callable actions
Chief create: GitHub create_issue(repository_full_name=VeritasDesign/free-frequency-genie-lab,title=[CYBERTRON TEST] <id> ...,body=human-readable scope + HTML comment CYBERTRON-WO-V0.1 followed immediately by JSON and closing -->).
Required JSON: version, id, requester, worker, task_type, target, scope, acceptance, production_release.
Chief readback: GitHub fetch_issue(repo_full_name=...,issue_number=N); fetch_issue_comments(repo_full_name=...,issue_number=N); GitHub fetch workflow run or job logs using the run ID in receipt.
Worker pickup: GitHub Actions issues.opened event. Runner validates payload and scope, checks existing completion receipt on that issue, then posts CLAIMED, RUNNING and completion receipt. Unsupported order posts BLOCKED receipt and fails the run. Existing receipt skips execution.
Status vocabulary: QUEUED (issue created), CLAIMED, RUNNING, COMPLETE, BLOCKED; FAILED (workflow failure with no completed receipt). Cancellation: closing issue before pickup is not currently enforced; no cancellation action has been implemented or proven. Retry: no automatic retries configured; re-run is manual. Concurrent issue event jobs are serialized by issue number, but cross-issue duplicate IDs are NOT prevented.

## Live proof
CYB-TEST-001: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/1
Worker run: https://github.com/VeritasDesign/free-frequency-genie-lab/actions/runs/36377219388
Worker source commit: c84443d9e94f13be3d5f0a377e24c380a7dad192
github-actions[bot] posted CLAIMED, RUNNING, COMPLETE in issue comments. Run completed success. No source edits or deployment.
CYB-TEST-002: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/2
Deliberately unauthorized scope production-write; expected BLOCKED. Check issue comments and workflow result before marking proven.

## Capability accounting
Level 1 durable dispatch: PROVEN for GitHub issue queue and Chief readback; another ChatGPT conversation retrieval is possible with authorized GitHub connector but not independently tested here.
Level 2 automatic pickup: PROVEN for GitHub Actions issues.opened; cross-ChatGPT chat invocation UNKNOWN / no mechanism demonstrated.
Level 3 execution: PROVEN only for allowlisted isolated GitHub Actions receipt test. Real software changes, arbitrary worker routing and independent ChatGPT workers NOT PROVEN.
Duplicate prevention: PARTIAL, existing receipt on same issue skips repeat; actual repeated pickup test NOT YET PROVEN, cross-issue IDs not deduplicated.
Cancellation: BLOCKED (not implemented).
Production release: BLOCKED by strict allowlist; no release action exists.
No metered service purchased. Existing Genie Pages workflow path filter excludes dispatch workflow changes, and the live Genie page was not edited.

# Cybertron dispatch v0.2 — 2026-09-28

Continuation of v0.1, not a replacement. Public queue; never post secrets or private work.

## Implementation
Worker workflow .github/workflows/cybertron-dispatch.yml.
First implementation c1400b750176f51f21c4ea31a4862b38beae249e; corrected concurrency implementation 562bdd58afffaaed8c31c1e2c50084e1ebd271c9.
Triggers: issue opened, edited, closed. Only titles prefixed [CYBERTRON TEST] and the exact allowlisted harmless-receipt-test, target free-frequency-genie-lab/dispatch, scope issue-comments-only, production_release=false. No project writes or deployments.
Global concurrency was attempted and found unsafe: GitHub cancelled a pending issue run (run 36377801287). Fixed to per-issue concurrency in 562bdd58. Cross-issue duplicate IDs use canonical lowest issue number from paginated issues; duplicates receive BLOCKED receipt. Same-issue terminal receipts skip repeated pickups; prior claim skips repeat if worker already running. Issue closure is checked before claim and after optional 15-second test delay. Closed issue gets CANCELLED, not COMPLETE. No automated retries. GitHub Actions issue events can still be dropped or pending runs cancelled by GitHub concurrency; a claim without terminal receipt requires operator inspection.

## Actual live receipts
- #3 CYB-TEST-003: CLAIMED, RUNNING, COMPLETE; run 36377797136; source c1400b7.
- #4 CYB-TEST-003: first global-concurrency run 36377801287 cancelled by GitHub before worker pickup; no worker receipt. This is an implementation failure caught and corrected, not proof of duplicate handling.
- #5 CYB-TEST-004: closed before pickup; CANCELLED receipt run 36377804835.
- #6 CYB-TEST-005: canonical ID order; run 36377865618 (check final status).
- #7 CYB-TEST-005: BLOCKED duplicate ID canonical #6; run 36377869268; source 562bdd5.
- #8 CYB-TEST-006: CLAIMED, RUNNING, then closed; CANCELLED receipt run 36377872036; no COMPLETE; source 562bdd5.

## Remaining limits
Same-issue repeated pickup must be separately triggered and checked. Duplicate detection is canonical issue number, not an atomic reservation against arbitrary simultaneous workers; this workflow's single GitHub Actions allowlisted task has no external side effect. Closing during a non-interruptible real task cannot roll back actions; the 15-second test proves cooperative cancellation only. GitHub issue edit can trigger pickup and is not authorization to change scope: changing order body after claim is a risk; production workers require immutable signed/commit-pinned orders and stronger authorization. Cross-chat ChatGPT invocation unproven. No arbitrary project execution. No production release mechanism. Protected projects and landing untouched.

## Final verification addendum
- #6 CYB-TEST-005 completed with receipt, run 36377865618, source 562bdd58.
- #3 CYB-TEST-003 issue title edited to trigger a second pickup; run 36377963667 succeeded with log `TERMINAL_RECEIPT_SKIP CYB-TEST-003`; the issue retains exactly one COMPLETE receipt. Repeated pickup PROVEN idempotent for this isolated test.
- #7 duplicate ID BLOCKED; #5 cancellation before pickup and #8 cancellation during 15-second active test both PROVEN.
- Caveat: no general atomic exactly-once execution guarantee, no forced interruption or rollback, and no cross-chat invocation. This is a test-only GitHub Actions worker.

# Factory learning receipt — Col Roku relay continuation (2026-10-19)

**Purpose:** Record manual Chief actions, evidence, and reusable automation opportunities while preserving owner approval gates. This is an operational improvement backlog, **not proof of Factory autonomy**.

## Recovery before construction
1. Owner asked to continue Col's Animal Alphabet. Chief recovered the prior GitHub issue #171, branch `col-animal-alphabet-pwa-v0`, Roku source, relay prototype, security review, and CI receipts. **Avoided:** rebuilding the tablet PWA, Roku v0.2 player, or relay.
2. Owner supplied Old Chief handoff. Chief reconciled its claims against existing source and tests. **Factory candidate:** context recovery task that follows issue references, reads the branch and acceptance evidence, and produces a VERIFIED/REPORTED/UNKNOWN inventory before coding.
3. Chief manually created continuation branch `col-relay-durable-design-20261019` and draft PR #174. **Factory candidate:** idempotent issue→isolated branch→draft PR dispatcher with branch collision checks and protected path allowlists.

## Actual repair loop
4. Chief manually edited local relay and test fixture for per-tap event IDs. The first test edit omitted the second event ID; Chief caught and repaired it at `796262b` before CI success. **Factory candidate:** after each edit, parse/test the actual branch HEAD and inspect changed tests; do not claim green based on source inspection.
5. Chief manually queried commit-specific Actions results: `39346003157` and `39346003161` PASS for the corrected continuation. Later `39346128704` and `39346128548` PASS for durable-core source. **Factory candidate:** automatically await and attach exact run IDs, conclusions, and HEAD SHA to the issue/PR. Avoid reporting a previous commit's green result for a new HEAD.
6. Chief manually wrote a source-only durable command core and restart tests, then checked CI. **Factory candidate:** reusable isolated build→test→receipt job with explicit NOT DEPLOYED state.
7. Chief manually posted a continuity receipt to issue #171. **Factory candidate:** append an idempotent checkpoint containing branch, commit, tests, blockers, and next action; keep an immutable audit trail.

## Recursive rule
Every bounded work order should produce **two artifacts**:
- **Product proof:** what changed, what tests actually passed, what is still blocked, deployment status.
- **Factory friction proof:** every manual step, whether automation is possible, required permissions, reusable part, test and falsifier.

Proposed state machine: `DISCOVERED → DOCUMENTED → IMPLEMENTED → TESTED → PROVEN_UNATTENDED`. Never label an idea as working automation.

## Safety boundaries
- Protect the already-working Fire PWA and Roku v0.2 ZIP; no changes to Listing Agent, HQ or production Workers.
- Human approval stays mandatory for deployments, credentials, costs, hardware pairing and destructive actions.
- An Actions PASS is **not** Roku hardware proof. The local relay is **not** approved for public deployment.
- The durable-core source is not a complete authenticated relay. Pairing, revocation enforcement, registration, rate limits and cost verification remain blockers.

## Next Factory improvement
Implement a **receipt-only, read-only** action that collects the current issue, branch HEAD, PR, Actions results and unresolved gates, then generates both receipts without changing source or deploying. Independently test it on issue #171 before generalizing to other projects.

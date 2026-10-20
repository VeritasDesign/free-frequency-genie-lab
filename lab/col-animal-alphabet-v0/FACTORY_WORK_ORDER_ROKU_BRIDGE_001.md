# Col Roku Bridge — Factory worker-ready bounded work order 001

**Owner:** Shannon · **Tracking:** issue #171 · **Draft PR:** #174
**Branch:** `col-relay-durable-design-20261019`
**Authority:** PROPOSE_ONLY for source work; **SHANNON_GATE_REQUIRED** for deployment, credentials, cost, and device installation.

## Mission
Implement a **source-only**, secure Cloudflare Worker + Durable Object bridge candidate using the existing relay protocol and tests. The first output is an isolated tested PR, **not** a deployed service.

## Existing source to reuse
- `relay-prototype/server.mjs`, `server.test.mjs`: volatile localhost protocol baseline.
- `relay-prototype/durable-core.mjs`, `durable-core.test.mjs`: command ID, idempotency, persistent revoke.
- `relay-prototype/durable-session.mjs`, `durable-session.test.mjs`: Node-only pairing model and tests.
- `relay-prototype/bridge-http-candidate.mjs`, `bridge-http-candidate.test.mjs`: single-receiver HTTP candidate.
- `ROKU_PAIRING_CONTRACT_v0.3.md`, `DURABLE_RELAY_IMPLEMENTATION_GATE.md`: contract and security requirements.
- `SOL_FREQUENCY_POLISH_AFTER_BRIDGE.md`: future polish gate.

## Acceptance criteria
1. Isolated Cloudflare runtime code and test harness; no imports of Node-only crypto in Worker.
2. Trusted owner provisioning is fail-closed; no publicly mintable receiver token or embedded admin secret.
3. Scoped receiver and sender credentials hashed at rest, revocable, with pairing expiry and bounded guessing.
4. Durable command IDs and event dedupe remain correct across restarts; distinct B→B taps restart playback.
5. Pairing-code lookup does not leak receiver IDs or allow cross-device access; explicit TV confirmation.
6. Request-size and origin restrictions, per-device/IP throttling, safe errors, minimal logging.
7. Exact reproducible local tests, CI receipt, security review and cost-limit check.
8. No deploy, merge, secrets, external registration or device changes.

## Factory conveyor boundary
Existing Dispatch Bus `free-frequency-factory` issue #70 accepts **READ_ONLY** work only. The proof-worker completed Col's message `col-roku-bridge-conveyor-proof-20261019-001` at [receipt 6280273654](https://github.com/VeritasDesign/free-frequency-factory/issues/70#issuecomment-6280273654). **Do not submit this implementation order to the v0.1 proof worker and pretend it was executed.** A coding-worker target requires separate reviewed authority and tested dispatch implementation.

## Proof required before promotion
VERIFIED / BLOCKED / UNKNOWN per criterion; exact changed files, branch SHA, test commands, Actions run URLs, security blockers, costs and rollback. Record manual friction in `FACTORY_RECURSIVE_LEARNING_001.md`. Human owner approves any deployment or installation.

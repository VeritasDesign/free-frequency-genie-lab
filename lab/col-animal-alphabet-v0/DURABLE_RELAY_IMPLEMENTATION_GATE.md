# Col Animal Remote — durable relay implementation gate

**Branch:** `col-relay-durable-design-20261019`. Source-only; NO live deployment.

## Recovered facts
- Fire PWA installed and accepted by owner; Element Roku v0.2 sideloaded sample HLS video played.
- Existing volatile relay is localhost-only and **must not** be deployed to a public server.
- Existing disabled Roku `ReceiverTask` and tests remain preserved. Do not overwrite the v0.2 playback ZIP.
- A Roku app polling an authenticated HTTPS service is the selected transport; third-party ECP POST is not approved.

## Smallest safe durable service
Isolated Cloudflare Worker plus isolated Durable Object per paired receiver is a candidate **subject to current plan/pricing verification**. Never reuse Listing Agent, HQ, or other production bindings.

### Storage model
One DO per opaque receiver ID; store hashes of scoped credentials, pairing expiration and one-time code hash, authorized sender token hashes, monotonically increasing command ID, latest allowlisted letter, and revocation state. Atomic command increments and expiration occur inside the DO. Avoid recording family names, tablet identifiers, video URLs, or tokens in logs.

### Required protocol
1. Receiver registration: owner-authorized bootstrap, with a revocable receiver credential. Never place an admin or global bootstrap secret in a downloadable Roku ZIP.
2. Pair start: authenticated receiver requests a short-lived one-time code shown on TV; require explicit TV-side confirmation before accepting a sender.
3. Pair complete: tablet submits code with rate limits; receive a scoped revocable sender credential. Treat browser storage as sensitive and add unpair/reset.
4. Select: sender submits only A–Z plus idempotency event key; service issues an atomic increasing command ID for each **new tap**. Repeated B taps get distinct IDs. Retry of the *same* event key must not double-play.
5. Poll: receiver fetches only its own latest command, after a validated cursor. No arbitrary URL input; receiver maps A–Z to allowlisted media.
6. Revoke: owner can invalidate sender and receiver access, including lost tablets.
7. Bound poll frequency, body sizes, retention, TTL, and storage operations; safe no-network status and capped retries.

### Verification before any live service
- Current Cloudflare free-tier limits and paid-feature requirements independently confirmed; zero-surprise-cost guardrails.
- Unit/integration tests for unauthorized bootstrap, code expiry, rate limits, wrong-device tokens, duplicate/replayed events, concurrent selections, B→B restart, revocation, stale cursor, malformed input, restart persistence.
- Security review explicitly closes critical/high findings from `relay-prototype/SECURITY_REVIEW_001.md`.
- Build candidate Roku ZIP separately, preserving v0.2. Test Element TV first, TCL later.
- Explicit owner approval before external deployment, credential provisioning, or changing installed tablets.

**Status:** DESIGN RECORDED. NOT IMPLEMENTED OR DEPLOYED.
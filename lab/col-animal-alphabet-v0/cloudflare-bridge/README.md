# Col relay Cloudflare candidate (NOT deployed)

Isolated Worker `col-animal-relay-isolated` + Durable Object `ColReceiver`. This is a source and CI candidate, **not** a live service. Existing Fire PWA and Roku v0.2 remain untouched.

## Protocol (candidate)
Requests require `receiverId=<opaque 12–64 char ID>`. Server-to-server operator provisioning uses `POST /api/provision` with `x-owner-secret` (never in a browser or Roku). A receiver obtains a receiver token, opens a short pairing window, displays a six-digit code on TV, confirms pairing, and the Fire tablet completes pairing to receive a sender token. Sender posts A–Z commands with fresh `clientEventId`; receiver polls with `after=commandId`. Repeating B with a new event ID must produce a new command. Revocation disables the receiver.

## Verified in CI
- Node Request/DO simulation tests, including B→B, pairing, CORS and invalid-input regressions.
- Wrangler `deploy --dry-run` bundle validation, with **no actual deployment**.
- 2 KiB streaming body cap; invalid UTF-8 rejected; exact browser origin and preflight header allowlist.
- Bounded recent idempotency receipts (128). Older event IDs may be replayed after eviction.
- Per-receiver pairing guess throttling: 12 attempts per 10 minutes, plus five wrong attempts in a pairing window.

## Release blockers (not yet verified)
1. **Actual Durable Object runtime:** test using Miniflare/workerd or isolated Cloudflare runtime, including SQLite migration and concurrent transactions. Node mock storage is not a substitute.
2. **Owner provisioning:** securely create, store, rotate and recover `OWNER_PROVISION_SECRET`; securely transfer a device-specific receiver token to Roku without printing secrets in CI or PRs.
3. **Abuse resistance:** edge/IP-based rate limits, resource usage, and complete security review; per-receiver throttle alone is insufficient.
4. **Cost/account:** verify Durable Objects eligibility, Workers Free limits and zero-additional-cost operation on the actual account; the user's token may have insufficient permissions for migrations.
5. **Client integration:** Fire pairing UI and sender credential persistence; Roku v0.3 receiver enabled with real hardware; licensed/verified A–Z media catalog and B→B playback proof.
6. **Distribution:** Roku signed package, beta access-code install for testing, and public certification for a permanent installation. See Roku candidate `DISTRIBUTION_GATE.md`.

The GitHub Actions repository secret `COL_RELAY_CLOUDFLARE_API_TOKEN` was stored by the user; only manual workflow dispatch can currently check its **presence**. That check does not prove validity or permissions. Deployment is deliberately disabled.

**Preservation:** no production routes, deployments, credential exposure, billing changes or changes to existing installed apps.

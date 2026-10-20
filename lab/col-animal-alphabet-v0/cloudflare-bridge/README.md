# Col relay Cloudflare candidate (NOT deployed)

Isolated Worker + Durable Object, source-only. Requires Cloudflare Durable Object eligibility, verified zero-additional-cost capacity and deployment authorization checks. Does not replace Fire tablet PWA or Roku companion.

## Current protocol
All requests require `receiverId=<opaque 12–64 char ID>`. Receiver provision: `POST /api/provision` with owner secret in `x-owner-secret` header, **server-to-server only**, never tablet. Returns device-scoped receiver token once. Receiver starts pairing, shows code on TV and confirms; tablet completes with code and receiver ID. Authenticated tablet sends A–Z with fresh `clientEventId`; Roku polls after commandId. Revoke invalidates receiver and sender.

## Known blockers — no deployment until resolved
- **Browser CORS/origin allowlist:** browser requests are intentionally not enabled yet; do not use wildcard origins. Only allow exact approved Fire PWA origin, and prevent credential leaks.
- **Owner provisioning:** secure operator-only bootstrap path and secret lifecycle, receiver ID generation and Roku device token installation need documented steps. Owner secret must never be present in browser/Roku.
- **QA:** Worker/DO runtime tests, concurrent transaction test, end-to-end Roku polling, reconnect and 26-item licensed media catalog.
- **Cost:** independently verify Durable Objects and Workers availability/limits in actual Cloudflare account before any deployment.
- **Retention:** event receipt keys currently persist without TTL/cleanup; add bounded retention and storage limits before deployment.
- **Security:** code-guess lockout per receiver is not equivalent to global abuse protection; add IP/account edge throttling and security review.

No routes, production deployment, credentials or billing changes are included.

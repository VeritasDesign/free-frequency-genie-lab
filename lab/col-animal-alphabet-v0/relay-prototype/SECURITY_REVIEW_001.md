# Security review 001 — Col Animal Relay

Status: **REVIEWED AS A LOCAL PROTOTYPE ONLY. NOT APPROVED FOR INTERNET DEPLOYMENT.**

## Evidence
- GitHub Actions local protocol tests passed on earlier prototype commit. A new run is required after hardening changes.
- Relay listens on 127.0.0.1 and now explicitly rejects requests whose socket peer is not loopback.
- All animal selections are restricted to one A–Z letter; each accepted request increments a command ID.
- Pairing codes are single-use, 6 digits and expire after 120 seconds. Pair completion is rate-limited per remote address.
- Credentials are randomly generated, hashed in memory, and compared using constant-time buffer comparison. No credentials are written to logs.
- Volatile in-memory state is not durable and is lost on process restart.

## Blockers before a public HTTPS service

1. **Critical — bootstrap:** /api/pair/start is unauthenticated. A public deployment would let anyone mint receiver credentials and pairing codes. A real receiver must authenticate with a provisioning credential or owner-authorized registration before starting pairing.
2. **Critical — storage/concurrency:** session Map and command counter are local process state. Serverless instances can disagree, and restarts erase pairing. Choose durable transactional state with atomic increments and TTL.
3. **High — pairing ownership:** six-digit pairing code by itself does not prove the requestor owns the Roku or tablet. Add on-TV confirmation and stronger throttling tied to a device registration; define recovery and revocation ownership.
4. **High — sender secrets in browser:** a tablet credential stored in browser storage can be exposed by XSS or shared-device access. Define least privilege, CSP, token lifecycle, and an explicit unpair flow.
5. **High — authentication and network:** enforce HTTPS at the edge, prevent token exposure in URLs and telemetry, enforce per-device quotas and bounded Roku polling.
6. **High — media:** Roku should resolve only server-controlled allowlisted video IDs, never play an arbitrary URL received from a tablet.
7. **Medium — command loss:** latest-only polling intentionally drops intermediate taps if the receiver is offline. Define whether to queue, coalesce, or show a disconnect warning; replay semantics must be tested.
8. **Medium — operational:** isolated service, explicit zero-surprise billing controls, health checks, retention, and rollback; no modification of existing production Workers or Vercel projects.

## Go/no-go

**NO-GO for public deployment.** Continue source-only development of a Roku Task client and Fire pairing UI behind test-mode flags. Request deployment authorization only after critical/high items are addressed, durable hosting cost boundaries are checked, and automated security tests pass.

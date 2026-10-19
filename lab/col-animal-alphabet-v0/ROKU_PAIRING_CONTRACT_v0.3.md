# Tablet → Roku pairing: implementation contract v0.3

Status: **design and test contract only; no service deployed, no tablet pairing proven.**

## Target experience

1. Parent pairs one Fire tablet to one Roku receiver with a short-lived one-time code displayed on the TV.
2. Each animal tap sends a **new monotonic event ID**, even for the same letter. A repeated tap restarts that animal's clip from the beginning.
3. The TV polls for the latest event using HTTPS and displays a clear disconnected state if network is unavailable. It must not keep retrying forever without feedback.
4. Family controls allow unpair/revoke. No advertising, tracking, third-party analytics, or private family identifiers.

## Trust and data boundaries

- The public tablet page **must not** contain shared service credentials or privileged API tokens.
- The Roku should hold a **device-scoped, revocable token**, not a service admin secret. A short pairing code must expire, be one-time-use, and be rate-limited.
- Sender requests require a separate paired-device credential and are authorized only for the paired Roku. The browser must never accept arbitrary video URLs; send only an allowlisted animal ID A–Z.
- Avoid raw device IDs, local IPs, passwords, names, and family photos in public logs.
- Store only the latest bounded command per paired TV, an opaque device ID, and token hashes; set expiry/retention.
- Use an isolated HTTPS service and durable backing storage; **do not** reuse production Workers, public HQ or existing business app storage.

## Candidate HTTPS protocol (not implemented)

- `POST /api/pair/start` authenticated by receiver device token → one-time display code (short TTL).
- `POST /api/pair/complete` with code + tablet-created nonce → revocable sender credential; enforce rate limits.
- `POST /api/animal/select` with paired sender auth and `{letter:"B",clientEventId:"..."}` → server-issued strictly increasing `commandId`. Return only allowlisted media IDs.
- `GET /api/receiver/next?after=<commandId>` with Roku device auth → newest command (or 204). HTTPS polling, no unsupported third-party ECP.
- `POST /api/pair/revoke` from authenticated pairing owner → revoke sender and receiver access.

Replay requirement: if two consecutive requests select B, the receiver gets distinct command IDs, stops the current Video node, replaces content, then plays at position 0. Avoid browser `sequence` alone for cross-reload ordering; server-issued command IDs are authoritative.

## Evidence gates

- [x] Real Fire tablet touch UI
- [x] Real Roku receiver launch
- [x] Real Roku HLS video playback
- [ ] Service/storage selection, isolated cost check and authorization
- [ ] Service implemented, security and concurrency tests
- [ ] Roku Task HTTPS polling and auth implemented
- [ ] Tablet pairing UI + sender implemented
- [ ] Licensed or owned per-animal clip catalog
- [ ] End-to-end A→B and B→B replay measured on actual Element TV
- [ ] Offline/reconnect/revoke verified
- [ ] Second Roku tested

## Work boundaries

Keep public launch, production projects, and monetization out of this private family proof. Avoid claiming that a sample Big Buck Bunny stream proves a licensed 26-animal catalog.

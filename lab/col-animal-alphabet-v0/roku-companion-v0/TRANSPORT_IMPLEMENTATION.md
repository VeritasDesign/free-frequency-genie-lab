# Roku receiver transport implementation checklist

**Status: not installed or device-tested.** The current v0.2 Roku Video node plays a public sample with remote OK. Do not replace it until a connected test is independently validated.

## SceneGraph Task boundary

- A `Task` node performs HTTPS requests using `roUrlTransfer` (not the render thread). Never poll from `onKeyEvent` or block the UI.
- Provision a receiver-scoped credential by an owner-approved mechanism. Do not put an admin key or password in the Roku ZIP.
- The Task polls `GET /api/receiver/next?receiverId=<opaque-id>&after=<last-command>` with `Authorization: Bearer <receiver-token>`. The endpoint and credentials must be HTTPS and scoped to a single family device.
- Parse JSON defensively; accept only `letter` matching A–Z and strictly increasing `commandId`.
- Send validated commands to the scene via observed Task output fields. The scene owns the Video node; Task must not modify UI nodes directly.
- For **every new command ID**, even the same letter twice, set Video.control = `stop`, create new allowlisted ContentNode, set Video.content, then `play`.
- On network timeout, show `Not connected — try again`; retry with capped backoff. Never display pairing tokens or network details on the TV.
- Pairing code is shown on TV, confirmed by an owner, expires rapidly, and is not written to logs.
- Define behavior when Roku sleeps, app exits, reconnects, or commands arrive faster than playback starts.

## Evidence gates

1. Automated syntax/static tests for BrightScript, XML and manifest.
2. Local fake-server contract test with B→B, B→A, offline, revoke, malformed JSON and stale command IDs.
3. Isolated durable HTTPS relay with authenticated receiver registration and explicit cost boundary.
4. One Roku v0.3 ZIP installed on Element TV and tested with real Fire tablet.
5. Licensed media clips per animal and family acceptance.

**Do not deploy the existing volatile Node relay to Vercel or Cloudflare.** It has non-durable memory and no secure family account/device registration. The optional local bootstrap secret is only an incremental hardening step, not a public security approval.

# Col Roku — distribution gate (2026-10-19)

Source: https://developer.roku.com/dev/docs/channel-publishing-guide and https://developer.roku.com/dev/docs/packaging-channels

## Existing artifact
`roku-companion-v03-candidate` is a SceneGraph Roku SDK candidate. It currently uses sample HLS media, the receiver task is disabled by default, and no authenticated live relay has been verified. Do not publish it as Col's finished player.

## Practical route
1. Keep current v0.2 sideload working during isolated v0.3 development.
2. Build and verify the v0.3 Roku SDK ZIP, including manifest, icons, media mapping, pairing UI, and receiver credential storage. Run hardware QA.
3. Enroll/use Shannon's own Roku developer account; do not give app ownership to SOL or Factory. Verify app category, required policy documents, and account eligibility in dashboard.
4. On the linked development Roku device, package and sign a `.pkg` using the Roku Application Packager; preserve signing key/password securely (human USB -> vault, never chat/issues/source).
5. Create a **Beta** SDK app in Roku Developer Dashboard, upload signed package, and use access code to install without recurring sideloads. Roku docs: up to 20 testers, updates via new package, 120-day expiration. **Beta is temporary**, not a permanent family installation.
6. For permanent distribution, meet Roku certification requirements and publish a **Public** SDK app in the Streaming Store. Updates go through Roku's normal update mechanism.

## Release gates
- No public or beta publication before real animal media licensing, child/family privacy review, secure pairing, account-cost verification, and physical Fire→Roku proof.
- SOL: research/inspect developer account and policy/certification prerequisites in its own Work chat; no credentials copied to chat. No submission without user approval.
- Factory: implement candidate Roku package and offline tests in branch; no hardware install or publishing.
- Chief: validate Cloudflare Durable Object runtime and relay deployment separately; preserve existing production Workers.

## Evidence needed
Roku model/OS, successful `.pkg` signing, beta access code installation, actual B→Bear and B→B restart, eventual public certification acceptance. Unknown until observed.

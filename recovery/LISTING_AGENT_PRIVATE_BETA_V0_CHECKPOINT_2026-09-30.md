# Listing Agent Private Beta V0 — Checkpoint — 2026-09-30

## Status
Private Beta V0 code candidate is complete and remains NON-PRODUCTION. No tester has been invited and no beta deployment has been authorized/executed.

## Proven production baseline
- Production Listing Agent release lineage baseline: `0a0882f37082290758852c2c9915a6276fd2b0c9`.
- Production Worker `free-frequency-factory` must remain unchanged by the beta.
- Commercial Listing Agent frontend was previously phone-verified live.
- Existing production eBay PREPARE/PUBLISH boundary remains accepted; no new eBay publication is claimed here.

## Private Beta V0
Repository: `VeritasDesign/free-frequency-factory`
Branch: `listing-agent-private-beta-v0-2026-09-30`

Initial V0 candidate:
- HEAD `c7b75df7c3ccd471160341656f4872208f228d61`
- Candidate ZIP SHA-256 `e059e96610b95f1d76775835b996fdc1ca3ae4c3158c0b2a9c43ef7b5e62ba77`
- Exactly three identities: Shannon/admin, tester-a, tester-b.
- Browser-local listing workspace; no cloud sync/backup.
- Per-user authenticated eBay OAuth; beta path has no Shannon/shared refresh-token fallback.
- Private user-namespaced images.
- Prepared-offer ownership enforced server-side.
- Server-side per-user quotas using a Durable Object.
- PREPARE and PUBLISH remain separate; explicit human confirmation preserved.

Required isolated beta resources:
- `BETA_PRIVATE` private KV: sessions, OAuth state, encrypted per-user eBay connection, prepared-offer ownership.
- `BETA_IMAGES` private KV: user-namespaced images.
- `BETA_USAGE` Durable Object: serialized/atomic per-user quota/rate accounting.
- Beta-only credential/session configuration and 32-byte token-encryption secret.
- AI Gateway credential.
- eBay application credentials/RuName configured for beta callback.
- Deliberately tiny candidate quota defaults: AI 2, research 5, prepare 2.

## Privacy amendment
Accepted V0 foundation: `c7b75df7c3ccd471160341656f4872208f228d61`
Amended branch HEAD: `9e007a4ce332df7d42dfe9b2de4bd8a78cb8054f`

Exactly four files changed from accepted V0:
- `cloudflare/beta-security.mjs` blob `0fb384bb26b18d0df9c72be3b2522ce577e0a6d0`
- `cloudflare/worker-beta.mjs` blob `6750cc082e86e6a62087541bbf1069582b4cfe28`
- `tests/beta-boundaries.mjs` blob `17b95ac31b512fc1bd3ba4caad7f87dd5f4601d1`
- `PRIVATE-BETA-V0.md` blob `b1120fbc0a2421e564dd913e8bfc1cd95467d0c9`

Privacy principle: meter the service, not the customer.
Shannon/admin may see operational usage/quota information only: opaque seat ID, enabled/access state, allowance/consumed/remaining, coarse operation counts, aggregate AI token/estimated cost when available, rejection counts, and coarse success/error counts.

Admin/usage tooling must NOT expose tester credentials/hashes, OAuth tokens, seller/account details, listing contents, photos, prices/items sold, prepared-offer contents, or private image contents/keys. The admin usage route must have no credential/token decryption path.

Factory reports `/api/beta/admin/usage` is Shannon/admin-only and explicitly whitelisted. Static privacy assertions inject fake private fields and verify they do not survive usage output. Fresh amended Node/Cloudflare-runtime execution was not available, so runtime proof of the amendment remains UNKNOWN until isolated beta deployment.

## Next gate
Cybertron isolated deployment PREFLIGHT only for exact amended branch HEAD `9e007a4ce332df7d42dfe9b2de4bd8a78cb8054f`.
Do not execute deployment until separately authorized.
Preflight must determine exact isolated Cloudflare Worker/environment, bindings/resources, beta callback URL/configuration, secrets, rollback/removal path, and verify no effect on production Worker, traffic, bindings, DNS, source lineage, or production seller state.

After an authorized isolated beta deployment, perform one bounded live A/B isolation proof:
1. A cannot act as B/Shannon.
2. Distinct eBay connections remain isolated; no Shannon fallback.
3. Exhausting A quota does not affect B.
4. A cannot publish B's prepared offer.
5. A cannot retrieve B's private images.
6. Usage view exposes operational consumption without private customer data.
7. PREPARE remains unpublished and PUBLISH remains explicit-human-confirmation gated.

Only after these proofs may external tester invitation be considered.

## Product direction
Two external people have expressed interest in using Listing Agent. Desired tester model: each tester uses their own eBay account, browser-local saved workspace, shared Free Frequency tools on limited/metered basis, and eventually paid access. Payment integration is intentionally deferred until identity/eBay isolation is proven.

Future priority after the beta path: reusable Free Frequency Product Sales + Waitlist Video Ad Maker, with SELL and WAITLIST modes. Do not interrupt the Listing Agent beta path to build it now.

## Artifact preservation requirement
Factory must preserve complete candidate ZIP artifacts whenever it creates a transferable candidate/package. Exact original ZIP bytes, SHA-256, provenance and receipt should be ingested into the private artifact warehouse `VeritasDesign/free-frequency-artifacts` when tool access permits. Storage does not imply approval, promotion, release or deployment.

Known initial Private Beta V0 ZIP:
`LISTING_AGENT_PRIVATE_BETA_V0_CANDIDATE_2026-09-30.zip`
SHA-256 `e059e96610b95f1d76775835b996fdc1ca3ae4c3158c0b2a9c43ef7b5e62ba77`.

Factory did NOT fabricate a new ZIP for the privacy amendment because its local checkout was incomplete. The canonical amended candidate is therefore currently the exact Git branch snapshot at HEAD `9e007a4ce332df7d42dfe9b2de4bd8a78cb8054f`; do not claim an amended ZIP exists until exact complete bytes are packaged and hashed.

UNKNOWN > invented continuity.


## Factory retirement handoff — 2026-09-30

### Canonical state at retirement
- Listing Agent production commercial release remains live by Shannon's field report and is untouched by this beta work. Production Worker `free-frequency-factory` remains strictly out of scope.
- Canonical Private Beta source remains `VeritasDesign/free-frequency-factory`, branch `listing-agent-private-beta-v0-2026-09-30`, HEAD `9e007a4ce332df7d42dfe9b2de4bd8a78cb8054f`.
- Existing isolated Cloudflare Worker is confirmed as `listing-agent-private-beta-v0`.
- At retirement, that Worker has no Git connection, no runtime variables/secrets, no bindings, and no Cloudflare Builds history. Its existing shell/manual version is NOT evidence of beta readiness.
- Git connection setup is in progress for `VeritasDesign/free-frequency-factory` using production branch `listing-agent-private-beta-v0-2026-09-30`, but **Connect has NOT been clicked**. No Git connection/write occurred.
- Required Cloudflare execution root is `apps/bucklist-listing-agent`. The current Cloudflare connection dialog does not expose project/root directory, so execution context must be VERIFIED before Connect.

### Beta actuator control plane
- GitHub repository rulesets are unavailable under the repository's current plan/state; Chief observed GitHub API 403: "Upgrade to GitHub Pro or make this repository public to enable this feature."
- Classic private-repository branch protection / paid environment protections are not an established control here. Treat the beta branch as unprotected input; do not weaken the threat model.
- Preserve Cloudflare as the credential/resource boundary. GitHub supplies candidate bytes; production Cloudflare capability must not be available to the beta actuator.
- Wrangler pin gate PASSED: exact version `wrangler@4.135.0`.
- Approved non-promoting actuator command:
  `npx wrangler@4.135.0 versions upload --config wrangler.beta.jsonc --strict`
- Actuator remains **versions upload only**. No promotion/deploy is authorized.

### Gates still open
- Resolve real beta-only `BETA_PRIVATE` and `BETA_IMAGES` KV IDs and prove they are newly created/non-production before use.
- `BETA_USAGE` / `BetaUsage` requires a separately authorized one-time bootstrap.
- Beta runtime variables, bindings and secrets remain unprovisioned/unapproved.
- eBay beta callback/RuName remains unresolved until the isolated Worker hostname/execution context is established; do not guess it.
- No tester invitations. Preserve the **LIMIT TORTURE GATE** before external tester access.
- No real tester OAuth connection, payment integration, or eBay publication is authorized.
- Production must remain untouched.

### Artifact continuity
The artifact/ZIP rule above remains mandatory: preserve a complete candidate/package only from complete exact bytes; compute SHA-256; retain exact original bytes; record provenance + receipt for `VeritasDesign/free-frequency-artifacts`; storage never implies approval or deployment. Never fabricate a ZIP from an incomplete checkout.

### Replacement Factory boot point
Boot from this checkpoint plus the canonical beta source HEAD above. Immediate next task is **verify Cloudflare execution root/context before Connect**. Do not click Connect or provision/deploy until separately authorized.

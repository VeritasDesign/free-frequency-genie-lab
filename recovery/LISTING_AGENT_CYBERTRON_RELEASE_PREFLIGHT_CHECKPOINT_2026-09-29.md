# Free Frequency — Listing Agent Release Preflight Checkpoint

Date: 2026-09-29
Status: PRE-DEPLOYMENT / NO RELEASE AUTHORIZATION
Purpose: Preserve the exact conveyor checkpoint after artifact-warehouse recovery work so Listing Agent release work can resume without reconstructing context.

## Conveyor state

- Astra commercial candidate completed.
- Factory integration completed.
- Echo independently verified the Factory integration candidate.
- Production release has **not** been authorized.
- Connection Tester is already live and phone-verified; do not touch it as part of this release.
- Artifact Warehouse is live and accumulating recovered historical artifacts; warehouse activity is separate from production release authority.

## Exact Listing Agent candidate

Artifact:
`LISTING_AGENT_COMMERCIAL_INTEGRATION_CANDIDATE_2026-09-29.zip`

SHA-256:
`c27ac77e081019cc3e520c599b4c8bf9c83dbd7b35cdb65bcf33ef3d0223e873`

The candidate passed Astra → Factory → Echo integration verification. Do not rebuild, redesign, repackage, or modify it during preflight.

## Production provenance already established

Production platform: Cloudflare Workers.

Actual production Worker:
`free-frequency-factory`

Important: `bucklist-production` is a stale Wrangler configuration name. Prior Cloudflare Workers Builds evidence showed CI overriding that name and deploying `free-frequency-factory`. Do not deploy using the stale target and do not use the Vercel release path.

Previously observed active production version:
`1f37b5f4-392c-4b5c-bcbb-4b47cae5b985`

Previously observed deployment evidence showed 100% production traffic on that version. This must be refreshed read-only immediately before any release authorization; historical evidence is not a substitute for current state.

Production source baseline previously associated with:
`VeritasDesign/free-frequency-factory`
commit `2c17e120057769ef97d222408c14a956a0958a2e`
app root `/apps/bucklist-listing-agent`.

Exact deployed frontend/Worker byte equivalence has not been independently proven from the historical Cloudflare evidence. Do not upgrade that UNKNOWN into a fact.

## Next assignment — Cybertron read-only preflight

Confirm, without changing production:

1. Current active `free-frequency-factory` production version and traffic allocation.
2. A usable rollback version/target exists.
3. Current production bindings/resources are compatible with the candidate.
4. An exact release-only configuration/command can target `free-frequency-factory` without relying on the stale `bucklist-production` name.
5. Whether strict deployed-byte equivalence is required and, if so, whether an authenticated version-tied readback/export path exists.
6. Every remaining UNKNOWN or blocker.

Return a concise READY / BLOCKED preflight receipt containing the exact active baseline, rollback target, binding comparison, exact proposed release target/configuration, remaining UNKNOWNs, and precisely what Shannon would be authorizing.

## Hard boundaries

- READ-ONLY PREFLIGHT ONLY.
- NO deployment.
- NO production traffic change.
- NO DNS change.
- NO binding/resource mutation.
- NO source-repository modification.
- NO candidate rebuild/repackage.
- NO release authorization inferred from prior approval of design/integration work.
- STOP before authorization or deployment.
- UNKNOWN > invented continuity.

## Parallel artifact-recovery note

Artifact warehouse recovery is still ongoing across older Free Frequency conversations. Multiple verified artifacts are already stored in `VeritasDesign/free-frequency-artifacts`, while additional real ZIP bytes remain transfer-blocked or referenced/missing. Do not wait for completion of historical artifact archaeology to perform this read-only Listing Agent preflight, and do not let warehouse storage status imply production approval.

Conveyor checkpoint:
**Astra → Factory → Echo VERIFIED → Cybertron READ-ONLY PREFLIGHT NEXT → Shannon authorization required before any production release.**

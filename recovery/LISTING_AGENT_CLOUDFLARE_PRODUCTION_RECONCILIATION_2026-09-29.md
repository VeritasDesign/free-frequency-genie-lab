# LISTING AGENT — CLOUDFLARE PRODUCTION RECONCILIATION
Date: 2026-09-29. Evidence source: Shannon's screenshots and pasted Cloudflare dashboard build log in Echo conversation. This document records observed evidence; it is not an independently authenticated Cloudflare API export or asset-byte readback.

## Actual deployment identity (corrects stale Factory handoff)
- Actual production URL: https://free-frequency-factory.echo-freefrequency.workers.dev/
- Actual Cloudflare Worker: `free-frequency-factory`, in Shannon's Echo Free Frequency Cloudflare account. Another Cloudflare account had no projects.
- Repository: `VeritasDesign/free-frequency-factory`.
- Build root: `/apps/bucklist-listing-agent`.
- Build source commit shown in Cloudflare build detail: `2c17e12` (abbreviated). Full GitHub commit supplied and verified separately: `2c17e120057769ef97d222408c14a956a0958a2e`.
- Build ID: `99eecc5`, marked successful, 1m26s; log timestamp 2026-09-25T14:26:12.713Z through 14:27:37.072Z.
- Build command: None. Deploy command: `npm run deploy:cloudflare` -> `wrangler deploy`.
- Crucial Cloudflare warning: `Failed to match Worker name. Your config file is using the Worker name "bucklist-production", but the CI system expected "free-frequency-factory". Overriding using the CI provided Worker name.` Hence `bucklist-production` is the CONFIGURED name, NOT the actual deployed Worker identity. Do not search for a separate bucklist-production Worker as the production baseline.
- Wrangler log: `Read 1 file from the assets directory /opt/buildhome/repo/apps/bucklist-listing-agent/public`; `No updated asset files to upload. Proceeding with deployment...`; `Uploaded free-frequency-factory`; `Deployed free-frequency-factory triggers`; production URL above.
- Log's exact version ID: `1f37b5f4-392c-4b5c-bcbb-4b47cae5b985`.
- Shannon's subsequent Cloudflare dashboard screenshot, 2026-09-29 ~20:02 local: Active deployment `1f37b5f4`, deployed 4 days ago, **100% traffic**. This links the successful build/version to the current active deployment at screenshot time.
- The exact GitHub source file `apps/bucklist-listing-agent/public/index.html` at commit `2c17e120057769ef97d222408c14a956a0958a2e` was independently fetched via GitHub connector; Git blob `6b094fdaccf5f85a0cc30790d14194e2b84843d0`.

## Candidate and gates
- Astra candidate: `LISTING_AGENT_FREQUENCY_COMMERCIAL_CANDIDATE_2026-09-29.zip`; SHA-256 `c9a4ff0627f947a2e5c618c60c972509351268944d1a2cd857707c1fac7492ba`. Candidate intake and preservation receipts: `recovery/LISTING_AGENT_COMMERCIAL_CANDIDATE_FACTORY_HANDOFF_2026-09-29.md`.
- Source-revision / active-deployment identity: **RECONCILED** from Cloudflare dashboard screenshot and build log, subject to their evidentiary scope. The full commit is supplied by GitHub and candidate receipt; Cloudflare UI displays abbreviated `2c17e12`.
- Deployed frontend asset bytes and Worker bundle: **NOT INDEPENDENTLY READ BACK**. The build log's no-updated-assets line is not a cryptographic byte-match receipt. Do not claim exact live byte equivalence solely from the log. Any policy requiring direct authenticated export or byte readback remains an explicit gate.
- Factory must reconcile candidate against the identified working source and assess whether source/build evidence satisfies its integration gate. If direct deployed bytes are mandatory, stop and identify the precise missing export. Do not invent hashes.
- No integration, tests, immutable integrated release artifact, or production deployment performed by this checkpoint. Do not treat Shannon's earlier visual acceptance of Astra's design as production-release authorization.

## Next worker order
Read this record and the candidate handoff first. Do not ask Shannon to repeat the Cloudflare dashboard hunt. Confirm candidate ZIP availability in your own working context; if missing, request its exact durable Git location or attachment, not reconstruction. Integrate only when the provenance gate is met, preserve the working AI/eBay backend and publish confirmation, run focused checks, and return a checksum-verified NON-PRODUCTION integration artifact. Actual production Worker is `free-frequency-factory`, NOT `bucklist-production`. No deployment without separate explicit authorization.

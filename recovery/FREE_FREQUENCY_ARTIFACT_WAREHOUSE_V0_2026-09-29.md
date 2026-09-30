# Free Frequency — Artifact Warehouse v0
Date: 2026-09-29. Owner: Shannon. Scope: ALL Free Frequency applications and recovery work, not only Listing Agent.
Status: DESIGN CHECKPOINT ONLY. No binary ZIPs uploaded, no private repository created, no deployment or workflow modified.

## Problem
Chat attachment continuity is unreliable. Workers need a durable, unambiguous way to retrieve the exact ZIP and its receipt without asking Shannon to reconstruct files.

## Requirements
1. Store actual immutable binary bytes; a Git Brain markdown link or SHA alone is NOT storage.
2. Content-address each file by full SHA-256; verify hash after upload AND after retrieval. Reject a path collision with differing bytes. Never silently overwrite.
3. Private access, least-privilege worker reads, separate writer/promoter rights. No tokens or secrets in manifests or ZIPs; inspect packages for secrets before storage.
4. Stable machine-readable index and human receipt: artifact_id, SHA-256, byte size, original filename, project, kind (candidate/integration/release/recovery), producer, timestamp, source repo/ref/commit, parent artifact(s), evidence receipt, storage locator, approval status, release authorization and deployed version (if any).
5. Upload is NOT approval. Approval and production authorization are distinct append-only events. No app deployment from warehouse ingestion.
6. Atomic ingest: hash -> upload -> readback verification -> index publication. Incomplete uploads remain unindexed/quarantined.
7. Preserve original ZIP bytes and receipt, not just extracted source. No retroactive assertion that historic missing ZIPs were recovered.
8. One retrieval instruction usable by Astra, Factory, Echo, Cybertron and Oracle; immutable locator and digest in every handoff.
9. Cost guardrails: start with a private GitHub repo for small packages ONLY if binary upload and worker readback are supported. GitHub Contents API wrapper available in current ChatGPT connector creates UTF-8 text files, not binary ZIPs. Do not claim it can ingest ZIPs. GitHub repository size, individual file limits and private-access permissions need confirmation before implementation. Git LFS or GitHub Releases asset uploads need verified tool support; otherwise use private object storage with signed read access.
10. Backup/retention, delete protections, and a tested restore/retrieval procedure before treating this as sole source of truth.

## Proposed layout (logical, backend-agnostic)
`objects/sha256/<first-two-hex>/<full-sha256>.zip` (private binary object)
`manifests/<project>/<artifact-id>.json` (append-only metadata)
`receipts/<project>/<artifact-id>.md` (human review)
`events/<artifact-id>/<event-id>.json` (promotion/authorization/release append-only history)
`index/projects/<project>.json` (derived discovery index)

## First acceptance test
Ingest the already verified Listing Agent integrated candidate `LISTING_AGENT_COMMERCIAL_INTEGRATION_CANDIDATE_2026-09-29.zip`, SHA-256 `c27ac77e081019cc3e520c599b4c8bf9c83dbd7b35cdb65bcf33ef3d0223e873`, with Factory and Echo receipts. Independently retrieve binary through worker-accessible path and recompute exact digest. Only then label warehouse LIVE. Do not imply that this test was performed.

## Next implementation gate
Select an actually writable private binary backend and confirm connector/API write + readback capabilities and cost limits. Current GitHub connector's `create_file` is text-only; this checkpoint is saved to Git Brain but the ZIP warehouse itself is NOT yet operational. Implement minimal uploader, verifier, manifest and retrieval path; no app release.

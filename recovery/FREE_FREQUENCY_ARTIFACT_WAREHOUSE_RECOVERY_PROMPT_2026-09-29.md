# Free Frequency — Artifact Warehouse Recovery Prompt
Date: 2026-09-29
Canonical private artifact warehouse: `VeritasDesign/free-frequency-artifacts`

Use this prompt in any prior Free Frequency Factory / Echo / Astra / Cybertron / Oracle conversation that may still possess ZIP/archive bytes.

---

## FREE FREQUENCY — ARTIFACT WAREHOUSE RECOVERY

Recover every Free Frequency ZIP/archive that is **actually available to you in this conversation/workspace** and preserve it in our canonical private artifact warehouse:

`VeritasDesign/free-frequency-artifacts`

**Do not recreate, approximate, or regenerate a missing ZIP. Only archive bytes you actually possess.**

For each available artifact:

1. Identify the project, original filename, purpose/stage, and any known source commit or parent artifact.
2. Compute SHA-256 and byte size from the actual file.
3. Check the warehouse first for an existing artifact with the same SHA-256. **Do not duplicate or overwrite identical artifacts.**
4. Upload the exact original ZIP bytes to the private warehouse.
5. Retrieve/read back the stored object and verify byte identity against the original.
6. Create a machine-readable manifest recording filename, project, artifact type, SHA-256, size, storage location, source/provenance when known, and verification result.
7. Preserve associated receipts/handoffs when available and link them from the manifest.
8. Treat storage as **storage only**. Do not mark an artifact approved, promoted, released, canonical, or deployed unless existing evidence explicitly establishes that status.
9. Do not deploy applications, modify production, alter existing source repositories, or delete old copies.
10. If an artifact is referenced but its actual bytes are unavailable, record it as **REFERENCED / BYTES NOT RECOVERED** rather than reconstructing it.

Use the existing warehouse convention established by the verified Listing Agent ingest as the canonical pattern. Preserve historical versions rather than deciding which old ZIP is “best.”

Return a recovery receipt containing:
- artifacts discovered
- artifacts newly stored
- duplicates already present
- SHA-256 verification results
- referenced-but-missing artifacts
- any artifacts skipped and why

**STOP after archival and verification. No deployments or production changes.**

---

## Operating principle

The warehouse preserves bytes and provenance. It does not grant release authority. Historical and obsolete artifacts should be preserved when actual bytes remain available; classification can occur later. A worker that cannot write binary bytes to the warehouse must report the artifacts it actually possesses and stop rather than claim archival success.

# HABITAT-001 — Retrieval Verification Receipt

**Date:** 2026-10-08  
**Scope:** Read-only registry-to-source lookup; no production changes.

## User-need query

> Find our existing system that understands which photographs belong to the same physical item.

## Evidence path

1. GitHub registry on `VeritasDesign/free-frequency-genie-lab`, branch `habitat-001-baby-eyes-part-recovery`, path `parts/visual-item-understanding.baby-eyes.json`.
2. Registry maps this need to capability ID `visual-item-understanding`, nickname **Baby Eyes**, source path `apps/bucklist-listing-agent/api/group-images-structured.js` in `VeritasDesign/free-frequency-factory`.
3. Independently fetched the referenced Factory `main` source.
4. The actual source blob SHA `c249675848e1d066f61a68b0008a333e2ac61d08` equals the blob SHA recorded in the registry.
5. Source inspection confirms `groups[].image_indexes` assigns photos to groups and validates every submitted index appears exactly once. Source also emits candidate listing fields.

## Outcomes

- **PASS**: Saved Part can be read and maps to a real existing source.
- **PASS**: Recorded source blob SHA agrees with current fetched source.
- **PASS**: Source code contains the advertised grouping and index coverage behavior.
- **NOT PROVEN**: Independent new-Chief discovery from only the natural-language need, because this execution already had prior conversation context and an explicit registry path.
- **NOT TESTED**: Live AI output, accuracy, deployed endpoint, or paid provider usage.

## Falsifier / next test

Give a separate Chief only the natural-language need, with no nickname, path, repo, or Part ID. Require them to discover the registry and source, return source SHA, and flag runtime as UNKNOWN. Their independently generated receipt determines whether the full handoff-discovery test passes.

**No additional infrastructure authorized or needed.**

**UNKNOWN > INVENTED. ROBOTS > CONVEYORS.**

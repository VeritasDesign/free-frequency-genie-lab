# HABITAT-001 — Independent Chief discovery test result

**Date:** 2026-10-08
**Source:** User-pasted transcript of separate Chief run; elapsed 31 seconds as reported by user.

## Prompt

Find our existing capability that can examine several photographs, determine which belong to the same physical object, and produce useful item details. Identify the existing implementation, verify its source, and report whether it's ready for reuse. Do not build anything.

## Observed response

Chief identified Listing Agent as the strongest candidate and correctly refused to claim source verification. It reported that connected GitHub index searches for multi-image grouping, image clustering, and Listing Agent vision returned no matching files. It did **not** find the actual handler or registered Part. Chief reported readiness NOT VERIFIED.

## Independently established source (separate from Chief's result)

- Repo: `VeritasDesign/free-frequency-factory`
- File: `apps/bucklist-listing-agent/api/group-images-structured.js`
- Source blob SHA previously fetched and verified: `c249675848e1d066f61a68b0008a333e2ac61d08`
- Registered Part: `parts/visual-item-understanding.baby-eyes.json` on this draft branch
- Source implements physical-item grouping and exact-once photo index coverage; this is **source proof**, not runtime readiness.

## Scoring

- Correctly named candidate product: PASS
- Preserved evidence limits / did not invent: PASS
- Found exact existing implementation: FAIL
- Found Part registry: FAIL
- Certified reuse readiness: appropriately NOT VERIFIED
- Live provider test: NOT RUN

**Interpretation:** Discovery-path failure, not proof that the Part is missing. Search-index misses must not be equated with absence of source. The registry is still on an unmerged draft branch, so default-branch search would not find it; this test alone cannot attribute the failure to the index, naming, scope, or draft-only visibility.

## Smallest next experiment

Have a separate Chief explicitly inspect the known existing `docs/PARTS.md` on Factory main and check the linked candidate handler by exact path, with no new infrastructure. Then determine whether an approved, minimal entry in the existing Parts index would improve natural-language discovery. Do not merge or deploy without review. Avoid training the test with the answer and then calling it blind.

**ROBOTS > CONVEYORS. UNKNOWN > INVENTED.**

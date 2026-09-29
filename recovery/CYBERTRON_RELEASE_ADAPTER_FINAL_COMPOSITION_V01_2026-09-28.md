# Cybertron — bounded Release Adapter final composition v0.1

## Identity and preserved evidence

- Original integrated adapter SHA-256: `1fb12d150ab12b253ee4f0c211aac8583b0fc33bb77dd139fb5a2b6f8750fc80`.
- Repaired local adapter SHA-256: `948beda0d2c614c6d790d3f2e1d6ce658eb75b1ddddd4740b0e0a3a669a859d8`.
- Exact reproducible additive patch: `lab/release_adapter/FINAL_COMPOSITION_V01.patch` (Git blob `f8673882aedc1f4dd6b5805af4576b9f0dba374d`). Apply to the existing integrated adapter with the original SHA only. This Git checkpoint stores the patch, **not** the complete 21,799-byte adapter source.
- Protected composition workflow: `.github/workflows/cybertron-release-composition-v01.yml` (Git blob `74b616e9c38ccc77bf7f9750888670c99c0bed63`; source commit `03d0aede996601d282cc3766ea95df79241f231b`).
- Prior read proof `36508350475`, release REST proof `36512653835`, CLI proof `36513875356`: reused as qualifications, not repeated.

## Exact repair

1. Normalize deployment `project.id` or `projectId` into `projectId`, and `readyState` or `state` into `state`; conflicting representations BLOCK. Both prior-production rollback capture and post-deployment identity/alias verification use the normalizer. Existing exact project/READY/alias/target checks remain unchanged.
2. The trusted read job runs in `Cybertron-vercel-readback` with `VERCEL_READ_TOKEN` only, writes an allowlisted four-field project receipt and binds it to the GitHub run. The separate release job runs in `Cybertron-vercel-release` with `VERCEL_TOKEN` only, checks same-run metadata and read-job artifact SHA-256. The adapter consumes `CYBERTRON_VERIFIED_PROJECT_RECEIPT`, never a read token in the release job; absent or cross-run receipt BLOCKS.
3. Release CLI explicitly receives `--token` from `VERCEL_TOKEN` within the isolated release runner. CLI arguments/output are never logged by the adapter. No read credential is substituted. This is an explicit CLI argument within the protected runner, not a claim that command-line arguments are invisible to processes on that runner.
4. Existing release-enabled profile, exact approval file, artifact and staging integrity, project ID/root, alias, rollback, explicit link, single deployment attempt, and four exact public byte readbacks are preserved. This workflow is **nondeploying**, with no release activation or approval generation.

## One bounded local nondeploying integration and PLAN_ONLY

- Local focused integration checks: PASS — nested deployment normalization; conflicting project rejection; same-run receipt acceptance; cross-run rejection; explicit CLI release-token routing (subprocess stub, no real CLI invocation).
- Unchanged approved Room Noise ZIP SHA-256: `c3e35e4ce114795c0810e4b269d6f0425ec96baaa7641fd872388db063f81da6`.
- Canonical archive and checksums: six verified artifact entries; four public byte-readback mappings; two nonpublic configuration entries. `PLAN_ONLY`; `release_enabled=false`; `mutation_count=0`. No Room Noise application test or modification.
- Protected two-job composition workflow has been committed but **not executed** to avoid repeating the already-proven read-authority investigation. No live combined credential handoff was proven in this step. The standalone patch was locally tested; it has not been executed inside the new workflow.
- No Vercel settings, aliases, credentials or production deployments changed.

## Determination

**READY as a bounded local integration candidate; BLOCKED for operational production release qualification until the protected two-job composition is exercised and the patched adapter is installed in its trusted release runtime.** Do not treat local PLAN_ONLY or prior separate credential proofs as proof of an executed combined release preflight. STOP before production consequence.

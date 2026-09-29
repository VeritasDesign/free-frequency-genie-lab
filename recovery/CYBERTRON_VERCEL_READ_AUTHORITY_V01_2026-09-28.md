# Cybertron — Vercel Read Authority v0.1 / checkpoint

**State: AUTHENTICATED PROJECT-ROOT GET PROVEN; ONE LOCAL PLAN_ONLY PASS; NO DEPLOYMENT.**

## Verified authority / source

- Git repository: `VeritasDesign/free-frequency-genie-lab` (isolated Cybertron lab).
- Protected Actions environment: `Cybertron-vercel-readback`.
- Secret name only: `VERCEL_READ_TOKEN`. The value is deliberately never read back
  outside the job, printed, committed, or packaged.
- Provider: `lab/vercel_read_auth/provider.py`, source Git blob
  `e27d2fdf4d57c71d9b87b159957baa676018648c`.
- Workflow: `.github/workflows/cybertron-vercel-readback.yml`, Git blob
  `2e17df64c2bd5d16a99c2c56ffdc52130c27da8d`.
- Provider source/workflow proof commit: `8680e268043ed88c78a52583aa49d4e2bfe8843c`.
- Authenticated proof Actions run (completed SUCCESS):
  https://github.com/VeritasDesign/free-frequency-genie-lab/actions/runs/36508350475
- Sanitized proof from github-actions[bot]:
  https://github.com/VeritasDesign/free-frequency-genie-lab/issues/28#issuecomment-5881931106

GET `/v9/projects/prj_0egxqb5S3QwPPUtMAiYJNAOHju86` with exact team scope
returned `{id:'prj_0egxqb5S3QwPPUtMAiYJNAOHju86',
name:'room-noise-instrument', accountId:'team_6lvKuv1CthbbshHpQoleqR2R',
rootDirectory:'apps/room-noise-instrument'}`. These are live provider fields.

## Consequence boundary

Provider source is read-only (fixed host, fixed GET project-detail endpoint,
no caller-controlled URL, no write method or deploy). Credential is injected in
one protected GitHub job step, not into application workers or artifacts. The
public comment is an allowlisted metadata receipt, NOT a credential and NOT a
signed deploy authorization. The environment may require human approval on
future uses. No unrelated GitHub workflow changed.

## Release adapter integration / evidence

- Original repaired adapter SHA-256:
  `39a1b53dff8f06ba28c398db0af98479fb850a1db01821bbe806b139d569a711`.
- New patched adapter SHA-256:
  `437f3a6c1401516280ea8206a5d09aad25a54f383228cb18c5de4c1021492abb`.
- Add `verify_project_identity` as shared gate; add protected
  `--verify-project-readonly` for authenticated project/root only. Original
  complete `preflight_project()` still verifies alias and existing production
  deployment, and existing link/approval/artifact/readback gates remain intact.
- Four focused infrastructure tests pass. No Room Noise application test run.
- Exact unchanged artifact SHA-256:
  `c3e35e4ce114795c0810e4b269d6f0425ec96baaa7641fd872388db063f81da6`.
- One actual-artifact `PLAN_ONLY`: six source checksums verified, four public
  readback mappings, two nonpublic configs, zero mutations, release_enabled=false.
  Inert plan reports remote_root_verified=false as it was run separately from
  the protected live readback. The verified remote root exists in the linked
  authenticated Actions receipt, not invented inside the local plan.

## Exact decision

**READY FOR AUTHORIZATION for the Root Directory metadata capability and
unchanged Room Noise PLAN_ONLY.** NOT released. The current release-disabled
profile, separate explicit approval, alias/rollback and full consequence
preflight must remain in force. No publication occurs in this checkpoint.

STOP BEFORE PRODUCTION CONSEQUENCE.
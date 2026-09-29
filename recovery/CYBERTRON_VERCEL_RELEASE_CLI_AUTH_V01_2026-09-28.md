# Cybertron — Vercel release CLI authentication v0.1

**READY for proceeding to existing release authorization gates; NO production consequence.**

## Preserved boundary and prior checkpoint

- Continuity baseline: `e9179d227d35efe31fef360cf9628096cd08d706`.
- Existing protected release environment: `Cybertron-vercel-release`, secret name `VERCEL_TOKEN`. Value never printed, returned, packaged or committed.
- Separate proven read environment: `Cybertron-vercel-readback` / `VERCEL_READ_TOKEN`. Unchanged and not accessed by this proof.
- Earlier REST preflight: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/30#issuecomment-5882481517 . No repeat REST proof in this step.

## One nonmutating CLI authentication proof

- Workflow: `.github/workflows/cybertron-vercel-cli-auth-proof.yml`.
- Source commit: `6394f93e751c4e74c46051e246d6c9cab942ffe1`.
- Exact run: `36513875356`, https://github.com/VeritasDesign/free-frequency-genie-lab/actions/runs/36513875356
- Sanitized receipt: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/31#issuecomment-5882634775
- Protected job performed exactly one CLI authentication invocation: `vercel whoami --token [redacted] --scope thebishco-6074s-projects`.
- Result: `READY`; `reason=none`; command returned success with nonempty identity output (identity and CLI stderr not published).
- No project link/relink, approval file, release-profile activation, application retest, alias/settings mutation, or deployment. No read-secret access. Zero production consequence.

## Gate disposition

This proof establishes that the exact protected `VERCEL_TOKEN` can authenticate the Vercel CLI used by the existing Release Adapter. It does **not** authorize a release or assert the remaining adapter gates have been passed. Preserve the existing exact project/root, alias, rollback-reference, artifact-integrity, release-enabled profile, exact approval, single-deployment-attempt, and post-deployment four-public-asset byte-readback gates. Do not deploy during capability proof.

**Determination: READY for the existing release authorization gates. STOP before production consequence.**

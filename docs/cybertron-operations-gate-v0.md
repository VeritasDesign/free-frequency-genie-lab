# Cybertron Operations Gate — controlled autonomy v0

Owner authorization: controlled autonomy, 2026-10-19. Scope: **VeritasDesign/free-frequency-genie-lab only**. No production merges, secret rotation, spending, or modifications to other Cloudflare Workers.

## Rules
- Read, branch, test, and open PRs: allowed. Require review for production merges.
- Isolated deployment: only named allowlisted target, explicit workflow dispatch and scoped GitHub environment.
- No user-provided secrets in chat, source, logs, PRs, or publicly readable artifacts.
- Treat GitHub workflow definitions and dependency code as privileged: no unreviewed changes to deploy workflow or credentials.
- No destructive action, billing changes, production rollback, or secret rotation without separate owner approval.
- On test/deploy failure: stop, preserve logs and SHA, fix on branch, rerun validation. Never silently broaden permissions.

## Initial isolated target
- Cloudflare Worker: `col-animal-relay-isolated`.
- Existing workflow: `.github/workflows/col-relay-isolated-deploy.yml`.
- Existing secrets: `COL_RELAY_CLOUDFLARE_API_TOKEN`, `COL_RELAY_OWNER_PROVISION_SECRET`.
- Roku receiver ID: `col-roku-livingroom-01`.
- **Do not invoke** `/api/provision` until a verified, owner-private one-time token delivery channel exists. A public repository's Actions logs and artifacts are not private channels. If already provisioned (409), stop; do not overwrite.
- Acceptance: Fire B → Roku Bear starts → B again restarts Bear, with observed evidence.

## Gate checks before production
1. PR diff review and passing relevant tests.
2. Verify changed paths and exact deployment target; prevent unrelated Worker modifications.
3. Require protected environment approval for production.
4. Record deployed commit SHA, endpoint health, observed behavior, and rollback SHA.
5. Rollback only with owner approval and a verified prior good revision.

## Current limitations
The connected GitHub interface can create branches, edit files, open PRs and merge, but does not expose general workflow dispatch or Cloudflare account operations. This policy alone does not grant those capabilities. Build a least-privilege dispatch bridge as a separately reviewed PR; do not install a broad PAT or expose account-wide tokens.

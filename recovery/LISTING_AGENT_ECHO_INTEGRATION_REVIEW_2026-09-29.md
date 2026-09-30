# Echo review — Listing Agent commercial integration candidate
Date: 2026-09-29. Decision: ACCEPT AS NON-PRODUCTION CANDIDATE ONLY. No production deployment authorized or performed.

Inputs inspected in Echo's working environment:
- Factory release ZIP: `LISTING_AGENT_COMMERCIAL_INTEGRATION_CANDIDATE_2026-09-29.zip`; independently computed SHA-256 `c27ac77e081019cc3e520c599b4c8bf9c83dbd7b35cdb65bcf33ef3d0223e873`, exact match to Factory receipt. ZIP integrity check passed, 15 entries.
- Original Astra ZIP: `LISTING_AGENT_FREQUENCY_COMMERCIAL_CANDIDATE_2026-09-29.zip`; independently computed SHA-256 `c9a4ff0627f947a2e5c618c60c972509351268944d1a2cd857707c1fac7492ba`.
- Every one of Factory's 15 release archive entries exactly matches the corresponding `candidate/` entry of the original Astra ZIP; no mismatches.
- Release `public/index.html` SHA-256 `dc627a56e630328046e19819e019bd4b0c68c3d457d3bee96d3b62c1e87a38bf`; matches Factory receipt. No preview/fixture entries and no `preview-guard` reference in release frontend.
- `RELEASE-MANIFEST.json` inside app is a historical application manifest, not Factory's release receipt. Preserve this distinction.
- Factory receipt reports 14 unchanged application files and original manifest validation; Echo independently confirmed exact 15-file equality to Astra candidate. This is a packaging check, not a fresh live eBay functional test.

Provenance: `recovery/LISTING_AGENT_CLOUDFLARE_PRODUCTION_RECONCILIATION_2026-09-29.md`. Active Worker `free-frequency-factory`, Cloudflare version `1f37b5f4-392c-4b5c-bcbb-4b47cae5b985` at 100% traffic at screenshot time, source commit abbreviated `2c17e12`; full pinned source `2c17e120057769ef97d222408c14a956a0958a2e`. Configured `bucklist-production` name was overridden by Cloudflare CI.

Remaining gate: exact deployed asset/Worker bytes NOT authenticated/read back. Reconfirm active version immediately before any release. Decide/document whether strict deployed-byte equivalence is mandatory; if so obtain authenticated version-tied readback/export. No production mutation until Shannon explicitly authorizes the exact release. Use Cloudflare-specific controls, not Connection Tester Vercel workflow. After authorized release, reconcile actual deployment and seller flows. Do not treat Astra's fixture tests as real eBay publish proof.

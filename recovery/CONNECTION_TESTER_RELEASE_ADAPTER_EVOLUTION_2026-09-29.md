# Connection Tester Release Adapter surgical evolution — 2026-09-29

Repository: VeritasDesign/free-frequency-genie-lab, main.
Scope: adapter readback classification only; no application source changes.

Changed:
- lab/release_adapter/adapter_repaired.py — exact top-level package.json/vercel.json and descendants of api/ exempted from PUBLIC HTTP source-byte readback; no exemption from canonical load_bundle checksum verification or publish staging SHA-256 checks. All other assets remain required public readback.
- lab/release_adapter/test_serverless_readback.py — focused regression tests for API integrity/readback, non-API exclusions, four-asset Room Noise reference behavior, unsafe paths and release_enabled gate.
- This receipt.

Adapter SHA-256 (ASCII source bytes): 38d581e6c10d52430256efe309a53ccb3032ef93277c9bcc30a12beb9893a074
Adapter Git blob: de1042f665c687e809db87c3e1411566d0c668e3

Focused tests: NOT EXECUTED. Local runner could not fetch GitHub source (DNS unavailable); no authorized remote test trigger was used. The regression test file was committed, but no PASS is claimed.
Room Noise four-asset PLAN_ONLY behavior: preserved by unchanged public readback selection for its existing profile; actual test result UNKNOWN.
Production deployment attempts: 0. Vercel mutations: 0. No production arming.

Release qualification: BLOCKED pending execution of the four focused tests. UNKNOWN > invented continuity.

# Cybertron Vercel release authority v0.1 — nondeploying checkpoint

State: BLOCKED for complete CLI-qualified release environment; release-token REST readback READY. No deployment.

- Isolated GitHub Actions environment: Cybertron-vercel-release; secret name VERCEL_TOKEN. No secret value was printed, committed, packaged, or transferred to ordinary workers.
- Separate proven read authority remains Cybertron-vercel-readback / VERCEL_READ_TOKEN; unchanged.
- Release-authority workflow: .github/workflows/cybertron-vercel-release-authority.yml; source revision bab4ce4b0c290f03c157114117f9b9badee7a850.
- Successful nondeploying alias/rollback GET proof: https://github.com/VeritasDesign/free-frequency-genie-lab/issues/30#issuecomment-5882481517 ; Actions run 36512653835. Target project prj_0egxqb5S3QwPPUtMAiYJNAOHju86; alias room-noise-instrument.vercel.app; prior READY deployment dpl_5J5AyK1e9K2uEDjQQ8bgRi7Cy89s. Zero Vercel writes or deployments.
- Existing integrated adapter SHA256 1fb12d150ab12b253ee4f0c211aac8583b0fc33bb77dd139fb5a2b6f8750fc80; approved unchanged Room Noise ZIP SHA256 c3e35e4ce114795c0810e4b269d6f0425ec96baaa7641fd872388db063f81da6.
- Focused local PLAN_ONLY passed: six artifact hashes, four public byte-readback mappings, two nonpublic configuration hashes, release_enabled=false, mutation_count=0; plan SHA256 7a43bdf3f385b2551fe127a34750cc116045e4cc7c152ee24d8090a8c5b05bdb. This unprivileged plan does not claim live root/alias proof.
- Exact approval artifact/file remains a distinct mandatory consequence gate. Release-enabled profile has NOT been activated. Existing alias, rollback, project/root, explicit linking, single-attempt, and public-byte-readback gates remain mandatory.
- The release token has been shown to authenticate Vercel REST GET, but Vercel CLI authentication has NOT been proven. An attempt to extend the workflow with nondeploying CLI proof was blocked before committing; no CLI proof exists. Do not infer deployment permission from REST GET.

Determination: BLOCKED for end-to-end release-authority readiness. STOP before production consequence.

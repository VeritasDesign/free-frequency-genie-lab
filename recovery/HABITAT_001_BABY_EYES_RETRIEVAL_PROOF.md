# HABITAT-001 — BABY EYES PART RECOVERY

**Objective:** Prove a future Chief can find an existing reusable visual capability from a need description, without being told its nickname. **Robot-first constraint:** this Part is intended for real machine/product eyes; no new conveyor infrastructure.

## Source truth

Current Factory `main` contains `apps/bucklist-listing-agent/api/group-images-structured.js` (blob `c249675848e1d066f61a68b0008a333e2ac61d08`). The source calls a model through Vercel AI Gateway, with default `google/gemini-2.5-flash-lite`, and accepts an ordered image array.

It requests physical-item grouping and structured candidate listing information. It validates that every submitted photo index appears **exactly once**; malformed model coverage is rejected rather than silently accepted. It warns the model not to invent rarity, authenticity, dates or variants. This is **source-level evidence**, not proof of accuracy, a successful live call, or present production deployment.

## The recovered Part

**Canonical capability:** Visual item understanding / sequential photo-to-item grouping.

**Human nickname:** Baby Eyes.

**Existing source host:** BuckList / Listing Agent.

**Potential consumers (not proven integrations):** Do I Buy This?, Justine, Echo, Wearable Lab.

**Outputs:** per-item image grouping, confidence, reason, condition, suggested title, item specifics, description, verify flags, and possible hidden-value clues.

**Critical limits:** No authentication, rarity, valuation or safety guarantee. Human verification before consequential listing, purchase, or device action. Paid model requests are not part of this recovery test.

## Discovery test

**Blind-style query (does not name the Part):**

> We need an existing capability that looks at a batch of photos, understands which photos belong to the same physical object, and returns candidate item attributes. What have we already built that does this, and where is its source?

**Expected result:**

- Identify the canonical capability **visual item understanding** and its nickname **Baby Eyes**.
- Return the exact source path, repository and blob SHA above.
- Explain its input/output contract and index-coverage gate.
- Distinguish existing implementation from proposed new consumers.
- Say **UNKNOWN** about runtime/accuracy unless fresh tests exist.
- Do **not** propose building a new vision service or creating a new repository.

## Proof status

**PASS — source recovered:** exact main-branch handler independently fetched and inspected.

**PASS — durable Part record created:** structured JSON is stored alongside this report on the same review branch.

**PENDING — independent cross-session lookup:** a separate Chief/session has not yet queried the registry and returned this Part without being given its nickname.

**PENDING — runtime/accuracy test:** no provider calls, production deployment, or paid requests were made.

## Stop rule

Stop after the source and Part are retrievable. Do not add an agent, vector database, new dispatcher, automatic harvesting service, or production integration just to make the test look more impressive.

**The next useful move is to apply this Part to an actual machine/product need after independent lookup succeeds.**

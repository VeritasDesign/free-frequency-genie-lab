-- Cybertron / Factory: DISPOSABLE PostgreSQL claim gate fixture.
-- Not a migration. Not authorized for Shared Brain or production.
-- The unique primary key serializes competing claims for one work order.
DROP TABLE IF EXISTS cybertron_claim_receipt_fixture;
DROP TABLE IF EXISTS cybertron_claim_effect_fixture;
DROP TABLE IF EXISTS cybertron_claim_gate_fixture;
CREATE TABLE cybertron_claim_gate_fixture (
  work_order_id text PRIMARY KEY,
  attempt_id text NOT NULL,
  owner text NOT NULL,
  fence bigint NOT NULL CHECK (fence > 0),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cybertron_claim_receipt_fixture (
  work_order_id text PRIMARY KEY,
  attempt_id text NOT NULL,
  owner text NOT NULL,
  fence bigint NOT NULL CHECK (fence > 0),
  task_class text NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}  work_order_id text PRIMARY KEY,
  fence bigint NOT NULL,
  payload text NOT NULL
);
-- Claim statement contract:
-- INSERT ... ON CONFLICT (work_order_id) DO UPDATE ... WHERE expired
-- RETURNING attempt_id, owner, fence.
-- A zero-row result means NOT OWNER (or an unresolved response).
-- Never infer ownership from Airtable's status or a prior read.
-- Fence must accompany any database-side consequential write.
-- A fenced commit updates completed_at while holding the claim-row lock;\n-- future takeovers MUST require completed_at IS NULL.\n-- External side effects require independent idempotency/fencing.
),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cybertron_claim_effect_fixture (
  work_order_id text PRIMARY KEY,
  fence bigint NOT NULL,
  payload text NOT NULL
);
-- Claim statement contract:
-- INSERT ... ON CONFLICT (work_order_id) DO UPDATE ... WHERE expired
-- RETURNING attempt_id, owner, fence.
-- A zero-row result means NOT OWNER (or an unresolved response).
-- Never infer ownership from Airtable's status or a prior read.
-- Fence must accompany any database-side consequential write.
-- A fenced commit updates completed_at while holding the claim-row lock;\n-- future takeovers MUST require completed_at IS NULL.\n-- External side effects require independent idempotency/fencing.

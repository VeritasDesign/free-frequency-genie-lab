-- Cybertron / Factory: DISPOSABLE PostgreSQL claim/receipt gate fixture.
-- NOT a migration. NOT authorized for Shared Brain, production, or Airtable.
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
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cybertron_claim_effect_fixture (
  work_order_id text PRIMARY KEY,
  fence bigint NOT NULL,
  payload text NOT NULL
);
-- Claim statement: INSERT ... ON CONFLICT UPDATE WHERE expired AND
-- completed_at IS NULL RETURNING attempt_id,owner,fence.
-- Fenced receipt statement: UPDATE claim SET completed_at=now() WHERE
-- exact attempt, owner, fence, unexpired, uncompleted RETURNING row;
-- INSERT receipt SELECT FROM winner in the SAME SQL statement/transaction.
-- Concurrent claim/takeover and receipt commit serialize on claim row lock.
-- No Airtable GET/PATCH operation is an atomic claim.
-- External effects still need their own fencing/idempotency.

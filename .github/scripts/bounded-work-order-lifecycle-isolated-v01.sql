-- Step 4 disposable lifecycle tables. Never run against live Neon/Shared Brain.
DROP TABLE IF EXISTS cybertron_work_order_events_fixture;
DROP TABLE IF EXISTS cybertron_work_order_fixture;
CREATE TABLE cybertron_work_order_fixture (
 record_id text PRIMARY KEY,
 work_order_id text NOT NULL UNIQUE,
 task_class text NOT NULL,
 payload text NOT NULL,
 next_action text NOT NULL,
 status text NOT NULL CHECK (status IN ('READY','CLAIMED','COMPLETE')),
 step integer NOT NULL DEFAULT 0,
 max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 2),
 attempt_id text,
 claimed_by text,
 fence bigint,
 result text,
 receipt jsonb,
 CHECK (
  (status='READY' AND step=0 AND attempt_id IS NULL AND claimed_by IS NULL
   AND fence IS NULL AND result IS NULL AND receipt IS NULL)
  OR
  (status='CLAIMED' AND step BETWEEN 1 AND max_attempts AND attempt_id IS NOT NULL AND claimed_by IS NOT NULL
   AND fence>0 AND result IS NULL AND receipt IS NULL)
  OR
  (status='COMPLETE' AND step BETWEEN 1 AND max_attempts AND attempt_id IS NOT NULL AND claimed_by IS NOT NULL
   AND fence>0 AND result ~ '^[0-9a-f]{64}$' AND receipt IS NOT NULL)
 )
);
CREATE TABLE cybertron_work_order_events_fixture (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 work_order_id text NOT NULL,
 status text NOT NULL,
 attempt_id text,
 fence bigint,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION cybertron_lifecycle_event_fixture() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO cybertron_work_order_events_fixture(work_order_id,status,attempt_id,fence)
 VALUES (NEW.work_order_id,NEW.status,NEW.attempt_id,NEW.fence);
 RETURN NEW;
END
$$;
CREATE TRIGGER cybertron_lifecycle_event_trigger_fixture
 AFTER INSERT OR UPDATE OF status,attempt_id ON cybertron_work_order_fixture
 FOR EACH ROW EXECUTE FUNCTION cybertron_lifecycle_event_fixture();
-- Adapter SQL must update READY -> CLAIMED only with a matching live claim,
-- and CLAIMED -> COMPLETE only with an exact durable receipt.
-- No trigger, table, or fixture is installed in production.

-- A CLAIMED -> CLAIMED reassignment increments step and preserves old owner
-- in cybertron_work_order_events_fixture. Receipt commitment must remain
-- fenced against the current claim row; no live schema migration is implied.

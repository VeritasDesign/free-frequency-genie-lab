#!/usr/bin/env bash
# DISPOSABLE POSTGRES ONLY. Does not touch Airtable, Neon, or production.
set -euo pipefail
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1 -F '|')
"${PSQL[@]}" -f .github/scripts/atomic-claim-isolated-v01.sql >/dev/null
claim() {
  local work="$1" attempt="$2" owner="$3"
  "${PSQL[@]}" -c "
    INSERT INTO cybertron_claim_gate_fixture(work_order_id,attempt_id,owner,fence,expires_at)
    VALUES ('$work','$attempt','$owner',1,clock_timestamp() + interval '5 minutes')
    ON CONFLICT (work_order_id) DO UPDATE
      SET attempt_id=EXCLUDED.attempt_id,
          owner=EXCLUDED.owner,
          fence=cybertron_claim_gate_fixture.fence+1,
          expires_at=EXCLUDED.expires_at,
          claimed_at=clock_timestamp()
    WHERE cybertron_claim_gate_fixture.expires_at <= clock_timestamp()
    RETURNING attempt_id,owner,fence;"
}
query() { "${PSQL[@]}" -c "$1"; }
assert_equal() {
  if [[ "$1" != "$2" ]]; then
    echo "ATOMIC_CLAIM_FAIL expected='$2' actual='$1' label='$3'" >&2
    exit 1
  fi
}
# Each pair uses two separate Postgres sessions, racing for the same unique key.
# This proves actual DB serialization in a disposable service, not Airtable CAS.
for n in $(seq 1 20); do
  key="CYB-ATOMIC-RACE-$n"
  a="$(mktemp)" b="$(mktemp)"
  claim "$key" "ATTEMPT-A-$n" "runner-A" >"$a" &
  pid_a=$!
  claim "$key" "ATTEMPT-B-$n" "runner-B" >"$b" &
  pid_b=$!
  wait "$pid_a"
  wait "$pid_b"
  out_a="$(cat "$a")"; out_b="$(cat "$b")"
  rm -f "$a" "$b"
  if [[ -n "$out_a" && -n "$out_b" ]] || [[ -z "$out_a" && -z "$out_b" ]]; then
    echo "ATOMIC_CLAIM_FAIL race=$n a='$out_a' b='$out_b'" >&2
    exit 1
  fi
  assert_equal "$(query "SELECT count(*) FROM cybertron_claim_gate_fixture WHERE work_order_id='$key'")" "1" "single durable owner"
  assert_equal "$(query "SELECT fence FROM cybertron_claim_gate_fixture WHERE work_order_id='$key'")" "1" "first fence"
done
echo "ATOMIC_CLAIM_RACES_PASS 20 independent two-session races; exactly one winner each"

# A lost response cannot authorize another claim. Reconcile by exact identity/fence.
first="$(claim 'CYB-ATOMIC-LEASE' 'ATTEMPT-A' 'runner-A')"
assert_equal "$first" "ATTEMPT-A|runner-A|1" "initial lease"
assert_equal "$(claim 'CYB-ATOMIC-LEASE' 'ATTEMPT-B' 'runner-B')" "" "foreign blocked before expiry"
assert_equal "$(claim 'CYB-ATOMIC-LEASE' 'ATTEMPT-A' 'runner-A')" "" "repeat does not silently renew"
assert_equal "$(query "SELECT count(*) FROM cybertron_claim_gate_fixture WHERE work_order_id='CYB-ATOMIC-LEASE' AND attempt_id='ATTEMPT-A' AND owner='runner-A' AND fence=1 AND expires_at>clock_timestamp()")" "1" "reconcile owner"
# Database-side fenced effect; stale attempts cannot commit to this fixture.
effect_a="$(query "INSERT INTO cybertron_claim_effect_fixture(work_order_id,fence,payload)
 SELECT work_order_id,fence,'effect-A' FROM cybertron_claim_gate_fixture
 WHERE work_order_id='CYB-ATOMIC-LEASE' AND attempt_id='ATTEMPT-A' AND owner='runner-A'
   AND fence=1 AND expires_at>clock_timestamp()
 ON CONFLICT (work_order_id) DO NOTHING RETURNING payload")"
assert_equal "$effect_a" "effect-A" "owner effect"
# Simulate an expired lease. Production lease timing is NOT being tested here.
query "UPDATE cybertron_claim_gate_fixture SET expires_at=clock_timestamp()-interval '1 second' WHERE work_order_id='CYB-ATOMIC-LEASE'" >/dev/null
second="$(claim 'CYB-ATOMIC-LEASE' 'ATTEMPT-B' 'runner-B')"
assert_equal "$second" "ATTEMPT-B|runner-B|2" "new fenced owner"
assert_equal "$(query "SELECT count(*) FROM cybertron_claim_gate_fixture WHERE work_order_id='CYB-ATOMIC-LEASE' AND attempt_id='ATTEMPT-A' AND fence=1 AND expires_at>clock_timestamp()")" "0" "stale fence invalidated"
stale="$(query "INSERT INTO cybertron_claim_effect_fixture(work_order_id,fence,payload)
 SELECT work_order_id,fence,'stale-A' FROM cybertron_claim_gate_fixture
 WHERE work_order_id='CYB-ATOMIC-LEASE' AND attempt_id='ATTEMPT-A' AND fence=1
   AND expires_at>clock_timestamp()
 ON CONFLICT (work_order_id) DO NOTHING RETURNING payload")"
assert_equal "$stale" "" "stale effect blocked"
assert_equal "$(query "SELECT payload FROM cybertron_claim_effect_fixture WHERE work_order_id='CYB-ATOMIC-LEASE'")" "effect-A" "prior effect preserved"
assert_equal "$(query "SELECT count(*) FROM cybertron_claim_gate_fixture")" "21" "no duplicated claim rows"
echo "ATOMIC_CLAIM_FENCING_PASS expiry takeover increments fence; stale database effect blocked"
echo "ATOMIC_CLAIM_DISPOSABLE_POSTGRES_PASS no external services or production writes"

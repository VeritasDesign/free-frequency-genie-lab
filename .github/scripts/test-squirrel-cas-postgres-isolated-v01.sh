#!/usr/bin/env bash
# Disposable PostgreSQL only. Reproduces Factory's existing fft_os_state JSONB CAS shape.
set -euo pipefail
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
query() { "${PSQL[@]}" -c "$1"; }
query "CREATE TABLE fft_os_state(id text PRIMARY KEY,state jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())" >/dev/null
for n in $(seq 1 20); do
  key="CAS-$n"
  query "INSERT INTO fft_os_state(id,state) VALUES('$key','{\"owner\":\"none\",\"round\":$n}'::jsonb)" >/dev/null
  a="$(mktemp)" b="$(mktemp)"
  # Exactly the handler's UPDATE ... WHERE id AND state=expectedState RETURNING id pattern.
  query "UPDATE fft_os_state SET state='{\"owner\":\"A\",\"round\":$n}'::jsonb,updated_at=now() WHERE id='$key' AND state='{\"owner\":\"none\",\"round\":$n}'::jsonb RETURNING id" >"$a" &
  pid_a=$!
  query "UPDATE fft_os_state SET state='{\"owner\":\"B\",\"round\":$n}'::jsonb,updated_at=now() WHERE id='$key' AND state='{\"owner\":\"none\",\"round\":$n}'::jsonb RETURNING id" >"$b" &
  pid_b=$!
  wait "$pid_a"; wait "$pid_b"
  out_a="$(cat "$a")"; out_b="$(cat "$b")"
  rm -f "$a" "$b"
  if [[ -n "$out_a" && -n "$out_b" ]] || [[ -z "$out_a" && -z "$out_b" ]]; then
    echo "SQUIRREL_CAS_FAIL race=$n a='$out_a' b='$out_b'" >&2
    exit 1
  fi
done
echo "SQUIRREL_JSONB_CAS_RACES_PASS 20 two-session races, one committed writer each"
query "INSERT INTO fft_os_state(id,state) VALUES('PAUSE','{\"habitat\":{\"squirrel\":{\"status\":\"RUNNING\"}}}'::jsonb)" >/dev/null
query "UPDATE fft_os_state SET state='{\"habitat\":{\"squirrel\":{\"status\":\"PAUSED\",\"snapshot_id\":\"snap1\"}}}'::jsonb WHERE id='PAUSE' AND state='{\"habitat\":{\"squirrel\":{\"status\":\"RUNNING\"}}}'::jsonb RETURNING id" >/dev/null
stale="$(query "UPDATE fft_os_state SET state='{\"habitat\":{\"squirrel\":{\"status\":\"RUNNER_WRITE\"}}}'::jsonb WHERE id='PAUSE' AND state='{\"habitat\":{\"squirrel\":{\"status\":\"RUNNING\"}}}'::jsonb RETURNING id")"
if [[ -n "$stale" ]]; then echo "SQUIRREL_CAS_FAIL stale runner committed" >&2; exit 1; fi
paused="$(query "SELECT state #>> '{habitat,squirrel,status}' FROM fft_os_state WHERE id='PAUSE'")"
if [[ "$paused" != 'PAUSED' ]]; then echo "SQUIRREL_CAS_FAIL pause lost" >&2; exit 1; fi
echo "SQUIRREL_JSONB_CAS_PAUSE_PASS stale runner rejected, snapshot state preserved"
echo "SQUIRREL_CAS_DISPOSABLE_POSTGRES_PASS no production writes"

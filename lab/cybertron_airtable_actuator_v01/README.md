# Cybertron Airtable Actuator v0.1

Bounded deterministic actuator for issue #111 / AIR-ROCK-003B.

State: BUILT on isolated branch; not production and not live until a real Airtable execution/readback succeeds.

The actuator is fail-closed: one base, one table, one record, exact persisted ADAPTIVE-B preconditions, allowlisted completion fields, idempotent identical replay, conflicting state rejection, and mandatory post-write readback. Credentials are runtime-only via `AIRTABLE_TOKEN`.

Local deterministic test:

```
node lab/cybertron_airtable_actuator_v01/test.cjs
```

Live execution is deliberately separate and requires an Airtable token in the runtime environment:

```
AIRTABLE_TOKEN=... node lab/cybertron_airtable_actuator_v01/cybertron-airtable-actuator-v01.cjs
```

No deployment authority is encoded here.

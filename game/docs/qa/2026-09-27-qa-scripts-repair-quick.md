# Adversarial QA — qa-scripts-repair (quick)

Scope: `game/scripts/qa/{state,prevention,cli,validate}.mjs`, `ledger.schema.json`, `tests/*` on branch `qa-scripts-repair` @ 7844a406. Out of scope: gameplay code (unchanged).

Verdict: **PASS WITH GAPS**

Attacks attempted against the repaired mechanism:

| Attack | Result |
|---|---|
| Re-admit an ACTIVE/TERMINAL assignment via `schedule` | refused at cmdSchedule and inside admitAssignment |
| Launder status/history through the re-admission merge input | merge strips `status`/`history`; ledger record stays truth |
| Duplicate assignment id clone | rejected (`already registered`) |
| `externalOccupied` non-integer/negative | rejected fail-closed |
| capacityLimit 99 | clamped to hard 5 |
| Worker-kind message with forged direction | rejected (must be opener.recipient -> opener.sender) |
| Second ASSIGN on same requestId | rejected (already opened) |
| Stale SEALED_RESULT poisons request terminal | stale flagged+persisted, excluded from terminal set; fresh result still lands |
| Fresh traffic on closed request | rejected (closed by terminal) |
| Conflicting SEALED_RESULT | rejected; identical replay idempotent (also under new id) |
| `record --kind assignment` minting RESERVED | kind removed from RECORD_COLLECTION |
| Overwrite CLOSED finding / SEALED review | assertReplaceable refuses |
| Crafted ledger: RESERVED + `history:[]` | MC14 flags missing CREATED anchor (added during review) |
| Timeout on QUEUED / result on FINISHED / unknown observedStatus | illegal-transition / unhandled-kind errors |
| `qualify` reporter drift or empty suite | `--test-reporter tap` + zero-test guard refuses vacuous verdict |
| Concurrent commit between load and save | commitLedger CAS on on-disk event count rejects |
| PU-30 historical ledger under new validator | correctly flags ASG-FORGED `CREATED->RESERVED`, `BLOCKED->BLOCKED`, missing anchors |

Gaps (deferred, Low/Nit):

- Count-based CAS misses same-length content swaps; every legitimate mutation appends an event, so only out-of-band file tampering evades it. No file locking: a cross-process write between CAS-read and rename is still a lost-update window — the lease is the serializer of record.
- `buildEvent` writes the payload file before the CAS check; a rejected commit leaves an orphan `events/NNNN.json`, overwritten by the next successful commit (self-healing).
- Message `phase`/`createdAt` ordering vs run phase is not enforced; temporal validation is post-hoc (MC2).
- `--lease` omitted still resolves via `leaseFromDir` — tautological for an adversary with FS access; value is accidental-misuse prevention. Real guard = CAS + journal.
- `observedRuntimeId` is only recorded on terminal observations, not `started`.
- `QUEUED -> QUEUED` edge in ASSIGNMENT_TRANSITIONS is currently unreachable (kept as documented legality).
- assertReplaceable covers terminal findings + SEALED reviews only; other pre-decision collections remain replaceable by design.

Verdict label is an Ops-A/D evidence input to the run ledger, not a run verdict.

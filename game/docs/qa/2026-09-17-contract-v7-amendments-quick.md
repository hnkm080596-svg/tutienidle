# QA Review: Combat Contract v7.1-v7.6 Amendments (6ed1ea33)

- Date: 2026-09-17
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/contracts/{capability,context,events,operations,periodic,results,selectors}.ts`, `game/src/core/battle/runtime/capability/{CapabilityValidatorRegistry,StaticCapabilityQuery}.ts`, `game/src/core/battle/runtime/scheduler/{CombatAuthorityPorts,CombatOperationBatchRunner,CombatOperationExecutor,CombatScheduler}.ts` (+ their .test.ts, `GameManager.battleCycle.test.ts`).
- Exclusions (user WIP, not task-owned): `TurnBattleSystem.ts`, `TurnBattleSystem.stacksPerAffectedTarget.test.ts`, `GameManagerTurnBattleOps.ts`.

## Scope and Risk Map
changed-risk-map: domain `combat-and-tribulation`; one-hop consumers: combat presentation/controls, loot+progression+persistence after combat; `deepAuditCandidate: false`, no unmapped paths. Escalation check: no save/cloud, clock, or Vue/Phaser lifecycle change — contract-level types + headless scheduler only; quick scope confirmed.

## Invariant Ledger
| ID | State/owner | Action + transition | Invariant | Attack operator | Oracle | Layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-SCHED-1 | run()/settle() single-flight, CombatScheduler | settle() invoked inside an in-flight drain | Exactly-once / Lifecycle | Reorder | reentrant call -> CombatSettlementFault, state=faulted | unit | high: nested settle would corrupt frame order |
| INV-SCHED-2 | workThisRun, CombatScheduler | mid-run root intake across many roots | Boundedness | Concurrency/Repeat | total work > 4096 -> guard fault | unit | high: livelock hole (Lens C M1) |
| INV-SCHED-3 | periodicRequestByOpId + scratch, scheduler | bridge mints periodic ops | Atomicity | Interruption | scratch commits only post-reservation; entry deleted at settled publish | unit | high: stale correlation -> forged/duplicated settled events |
| INV-SCHED-4 | eventOrdinalByScope, scheduler | settled-event id minting | Determinism | Value mutation | `evt.${opId}.${ordinal}` unique vs op-sink emissions | unit | high: eventId collision breaks dedup |
| INV-SCHED-5 | combatSequence, scheduler | ctx stamping + settled-event stamp | Monotonicity | Reorder | seq(op) < seq(its emissions) < seq(settled) | unit | high: causality order |
| INV-SCHED-6 | generated opId `periodic.${requestId}` | duplicate requestId in one event / across events | Atomicity | Repeat | group-atomic duplicate fault; reserved-id fault | unit | high: producer bug must fault, not silently drop |
| INV-EXEC-1 | executor dispatch | execute(op, ctx) for all new op types | Correctness | Value mutation | typed results incl. RemoveBuffResult/CleanseResult/TriggerPeriodicStartResult | unit | medium: wrong routing -> silent no-op |
| INV-BATCH-1 | preflight/validateBatchStructure | null precondition, negative heal/shield amount, new op payloads | Boundedness | Value mutation | structural fault / preflight fail | unit | medium |
| INV-CAP-1 | CapabilityValidatorRegistry | unknown CapabilityType at def-load validation | Recoverability | Value mutation | throw on unregistered type | unit | medium |
| INV-CAP-2 | StaticCapabilityQuery | caller mutation of internal grant set | Synchronization | Stale state | defensive copy at construct | unit | low |

## Verification Evidence
| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx tsc --noEmit` | clean | full project |
| `npx vitest run src/core/battle` | 96 files / 755 tests PASS | includes all scheduler/executor/contract suites |
| `npx vitest scheduler+contracts+capability+GameManager.battleCycle` | 12 files / 158 tests PASS | amended call sites re-verified |
| INV-SCHED-1 | resolved | `life.settle()` inside in-flight run -> CombatSettlementFault (test at CombatScheduler.test.ts:1429); run()-inside-run likewise (:1534) |
| INV-SCHED-2 | resolved | cross-root ping-pong test: 2-authority mutual recurse -> `settlement_work_budget_exceeded` |
| INV-SCHED-3 | resolved | unforgeable `periodic.*`-shaped opId test: no settled event emitted without bridge correlation |
| INV-SCHED-4 | resolved | adversarial scope/op-id collision test passes |
| INV-SCHED-5 | resolved | ctx.combatSequence increment test + settled-event seq ordering |
| INV-SCHED-6 | resolved by new QA tests (this report) | see below |
| INV-EXEC-1 | resolved | executor routing cases for set_buff_stacks/duration/cleanse + typed results |
| INV-BATCH-1 | resolved | null-precondition guard + `amount >= 0` on heal/shield; new op payload validation in place |
| INV-CAP-1 | resolved | registry tests: unknown type throws; registered validator invoked; instance-kind grants validated |
| INV-CAP-2 | resolved | StaticCapabilityQuery copies constructor arg |

## Findings
No Confirmed defects.

### QA-2026-09-17-01: duplicate periodic requestId faults atomically (behavior verified, coverage added)
- Severity: Low (behavior was already correct; gap was coverage)
- Status: Coverage gap -> now covered
- Invariant: Atomicity — a produced group with duplicate generated operationIds must fault before any member executes.
- Reproduction: one PeriodicRequestsCommitted carrying two requests with identical requestId -> `periodic.req.dup` x2 -> CombatSettlementFault, zero ops executed. Cross-event reuse of a reserved requestId -> CombatSettlementFault; the first (legit) request's op had already run, second never ran.
- Evidence: CombatScheduler.test.ts `qa: periodic requestId -> generated operationId collision` (2 tests, green).
- Owner subsystem: runtime/scheduler periodic bridge + group reservation.
- Blast radius: producer-side bug only; fault is loud and atomic — intended.

### QA-2026-09-17-02: CapabilityValidatorRegistry has no production caller yet
- Severity: Low (intentional per plan)
- Status: Coverage gap (by design)
- Invariant: Recoverability — unknown capability types must throw.
- Note: contract megaplan line 276: "owner modules register validators at composition time; the buff registry validates every grant at def load" — the call site is Buff M2 scope. Registry + unknown-type throw verified by its own tests.
- Test file: runtime/capability/CapabilityValidatorRegistry.test.ts

### QA-2026-09-17-03: malformed `requests` (non-array) on PeriodicRequestsCommitted -> TypeError classified 'unexpected_error'
- Severity: Low (Nit)
- Status: Suspected (static read; not reproduced — reachable only via a malformed producer payload)
- Invariant: Recoverability — a broken command graph should report as structural_fault.
- Evidence: `periodicBridge` calls `event.requests.map` unguarded; a non-array payload throws TypeError, recorded as 'unexpected_error' rather than 'structural_fault'. Either way the scheduler faults — classification accuracy only.
- Test file: none

### QA-2026-09-17-04: `PeriodicResolution` type retained but unreferenced
- Severity: Nit
- Status: Coverage gap (dead export)
- Note: plan-pinned per megaplan; removal deferred to the milestone that consumes it.

## New or Changed QA Tests
- `src/core/battle/runtime/scheduler/CombatScheduler.test.ts` — new describe `qa: periodic requestId -> generated operationId collision` (2 tests): proves duplicate-requestId inputs fault atomically (no silent drop) and reserved-id reuse faults with honest partial progress (first op ran, second never did).

## Gaps and Residual Risk
- CapabilityValidatorRegistry integration point is deferred to Buff M2 by plan — re-check wiring then.
- `PeriodicResolution` dead export — Nit, plan-pinned.
- QA-2026-09-17-03 (error classification) — Nit, faulting either way.
- Full `npm run verify` not yet run on this commit (scheduled pre-merge); scoped verification green.

## Pre-existing Failures
None observed in scope. User WIP files (excluded above) are mid-edit by the user and were not audited.

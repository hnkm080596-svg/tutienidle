# QA Review: combat-contract (feat/combat-contract, 21ac93cf..d62cc7df)

- Date: 2026-09-17
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/contracts/**`, `game/src/core/battle/runtime/**`, `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/battle/turn/*.test.ts` (6 updated), `game/src/core/combat/CombatSystem.ts`, `game/src/core/combat/EntityVitalsSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/core/game/GameManagerTurnBattleOps.ts`, `game/src/core/game/GameManager.battleCycle.test.ts`, `game/tests/architecture/cultivationPathIsolation.test.ts`, docs under `game/docs/{architecture,systems,qa}` + `roadmap.md`.

## Scope and Risk Map

Mapper output: domains `combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`, `time-and-offline`; `deepAuditCandidate: true` ("critical state boundary: time-and-offline", "cross-system change: 4 domains"); unmapped: the 4 docs files, `GameManagerTurnBattleOps.ts`, `GameManager.battleCycle.test.ts`, `cultivationPathIsolation.test.ts`.

**Escalation decision — not escalating, risk confidently bounded by inspection:**

- `GameManager.ts` diff = `setBattleRngFactory` signature `(() => () => number)` → `(() => CombatRng)` + doc comment. No save/offline/time logic; the `time-and-offline` hit is a path-keyword false positive.
- `economy-and-progression` touch = `EntityResourceAdapter` (dormant) delegating `the`-pool gains to `TheEconomy.grantThe` (single clamp authority — same as `consumeResourceFor`) + an architecture-allowlist line.
- `pinia-phaser-sync`: zero Vue/Pinia/Phaser scene or bridge code changed.
- The new scheduler spine is **dormant** — constructed per battle but no production path enqueues or runs it (grep: zero non-test `enqueueAuthored`/`run()`/`createLifecycleSink`/`registerImmediateHandler` calls). The only live-behavior change is the RNG reroute, which has dedicated determinism evidence.
- Unmapped paths routed manually: `GameManagerTurnBattleOps.ts` → combat domain (composition-root wiring, reviewed line-by-line at M4); `GameManager.battleCycle.test.ts` → combat (test-only import swap); `cultivationPathIsolation.test.ts` → economy/progression (allowlist addition only); docs → no runtime risk.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CC-1 | Per-cycle RNG stream / `GameManagerTurnBattleOps.mintCycleRng` | All 16 roll sites rerouted through one `CombatRng` | Determinism — same seed → same outcome; consumption count+order preserved | Reorder + repeat | Two seeded battles produce deep-equal per-tick logs; different seed diverges | Vitest integration (`TurnBattleSystem.rngContract.test.ts`) | High — the only live-behavior change |
| INV-CC-2 | Roll domain / `CombatRng` impls | `rollChance(0/1/NaN)`; scripted exhaustion | Boundedness + determinism — exactly one consumption, no silent fallback | Value mutation | `roll()<chance` single consumption at all endpoints; exhaustion throws (structural fault) | Unit (`rng.test.ts`) + code inspection | Medium |
| INV-CC-3 | Live battle path | Any remaining `Math.random`/raw-closure bypass | Determinism | Stale state | `Math.random` stack-spy test shows zero combat-path stacks; grep audit of RNG graph | Vitest (`battleCycle.test.ts` session-RNG) + grep | High |
| INV-CC-4 | Scheduler dormancy | Production paths must not dispatch through scheduler | Lifecycle | Repeat/reorder | Zero production `enqueueAuthored`/`run()`/`createLifecycleSink`/`registerImmediateHandler` | Grep (verified at M5 review) | High — dormancy is the safety claim |
| INV-CC-5 | `CombatSystem.applyDotDamage` callers | Signature now returns applied HP | Regression | Repeat | Existing caller `BuffSystem.ts:356` ignores additive return; type-check green | Type-check + suite | Medium |
| INV-CC-6 | Stale scheduler across `abandonBattle` | Retained instance read after teardown | Lifecycle | Interruption | Field read only at engine construction; re-minted per cycle | Code inspection (M4 review) | Low |
| INV-CC-7 | Gauge adapter liveness | Stale `participant.alive` cache passes gate mid-resolution | Stale state | Stale state | `invalid_target_state` skip when entity dead but cache alive | Unit (`ActionGaugeAdapter.test.ts` regression — added at M4 fix) | Medium (dormant path) |
| INV-CC-8 | Adapter field fidelity | `hitCount`/`canCrit`/`canMiss`/`tags` not carried | Cross-system chain | Cross-system chain | Dormant path; recorded deferred to skill megaplan (learned-defect RR8 pattern noted) | Coverage gap — dormant, no live oracle needed | Low while dormant |
| INV-CC-9 | `resolveSourceBuffs` wiring | `legacy_dot` ops preserve authored `dotRecovery` | Conservation | Stale state | Resolver character-identical to engine's (`players→enemies` by participant id, own-pool `getAll`) | Code inspection (M4 review) | Medium (dormant path) |
| INV-CC-10 | `setBattleRngFactory` callers | Old `() => () => number` callers break | Contract | Repeat | Only 2 test callers + delegation chain; type-check green | Type-check | Low |
| INV-CC-11 | Cross-root work budget / `workThisRun` | Mid-run intake (lifecycle emits, `enqueueEvent`/`enqueueAuthored` in-flight) minting unbounded fresh per-root budgets | Livelock safety — total work across ALL roots of one drain bounded by `MAX_TOTAL_WORK_PER_RUN` (65536) | Repeat | Event-mint flood inside one authority call faults (`settlement_work_budget_exceeded`) instead of flooding | Unit (`CombatScheduler.review-round-2.test.ts` Lens C2; `CombatScheduler.test.ts` `maxTotalWorkPerRun: 30` budget test) | High — closes the last unguarded loop |
| INV-CC-12 | Periodic correlation / `periodicRequestByOpId` | `PeriodicOperationSettled` emitted exactly once per periodic op's barrier, into enclosing frame | Exactly-once + causality — `causationOperationId` = periodic op, `seq(op) < seq(settled)`, canonical `evt.${opId}.${n}` id, one-shot map entry deleted on read | Reorder + interruption | Sibling periodic ops all settle before any settled event fires, in request order; correlation survives no public op field (unforgeable) | Unit (`periodic_operation_settled` suite ~`CombatScheduler.test.ts:1259`; Lens C3 multi-request ordering) | High (dormant path; contract surface for buff megaplan) |
| INV-CC-13 | Forgeable event types | Producer emitting `periodic_operation_settled`/`combat_settlement_fault` via a sink payload | Integrity — scheduler-originated types unreachable from producer lanes | Value mutation | `commitEvent` structural-faults on both type strings | Unit (Lens B6 `review-round-2.test.ts:220`) | Medium |
| INV-CC-14 | Lifecycle `settle()` | Sequential periodic units each get a drain + per-op status map; reentrancy | Single-flight + isolation — same drain loop as `run()`, collector reports every executed op, reentrant/post-fault call is a structural fault | Interruption | `settle()` drains authored + root events; statuses map opId→status; reentrant `settle()` faults | Unit (Lens C4 `review-round-2.test.ts:185`; `CombatScheduler.test.ts:1386-1436`) | Medium (dormant path) |
| INV-CC-15 | Correlation commit ordering | `pendingPeriodicCorrelation` scratch committed only after group-atomic reservation passes | Atomicity — a structural fault mid-group leaves zero stale correlation | Interruption | Duplicate `requestId` → both `periodic.${requestId}` ops fault before either executes; later re-mint collides with reserved id | Unit (`CombatScheduler.test.ts` `qa: periodic requestId` suite, `bca9c55e`) | Medium |
| INV-CC-16 | Bridge request validation + forwarding | Malformed periodic requests minting ops carrying undefined/NaN; `snapshot`/`stackCount` dropped | Integrity + field fidelity — requests validated for required fields + finite numbers before op construction; forward-carriers ride to `deal_damage` payload | Value mutation | Heal missing `amount` → structural fault; `snapshot`+`stackCount` present on payload | Unit (Lens B2/B5 `review-round-2.test.ts:361-376`) | Medium (dormant path) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (= type-check + build + `npx vitest run`) from `game/` | PASS — 636 files / 5370 tests (+4 expected-fail), build clean | Full run at final HEAD `d62cc7df` (post-v7.x + review-round-2 fixes) |
| `npx vitest run tests/architecture` | PASS — 428 tests | Run at M4 (`c32ccb3e`); architecture diff since then is docs+test-only |
| Playwright `tests/e2e/create-to-combat.spec.ts` | PASS | Real-browser run at M4 in this worktree |
| `TurnBattleSystem.rngContract.test.ts` | Green in suite | Two SeededCombatRng(42) stage battles → deep-equal logs; divergence guard |
| `GameManager.battleCycle.test.ts` session-RNG spec | Green in suite | `Math.random` stack-spy — zero combat-path stacks |
| `ScriptedCombatRng.roll()` exhaustion | Throws structural-fault error (read at HEAD) | No silent `Math.random` fallback — matches contract §50; test-only impl trusts script domain |
| `applyDotDamage` production callers | `BuffSystem.ts:356` ignores additive return value | `applyReactionDamage`/`grantWard` consumed only by dormant adapters |
| `npx vitest run src/core/battle/runtime/scheduler/` at `bca9c55e`+ | PASS — 10 files / 139 tests | Covers v7.x: executor routes all 20 op types, settled-event suite, lifecycle `settle()`, cross-root budget, collision guards |
| v7.x scheduler mechanics inline re-review (`CombatScheduler.ts` read at `d62cc7df`) | Coherent | `workThisRun` charged at exec/settle/mint; scratch→commit ordering; settled event minted canonically + pushed to enclosing frame FIFO; forgeable-type guard; single-flight `settle()` |

## Findings

None. All material hypotheses resolved by named green tests, grep evidence, or the M4 roll-site audit. The one defect-class found during implementation (INV-CC-7 stale-liveness) was fixed at `1eba985c` with a regression test before this QA pass — recorded here as resolved, not as an open finding.

## New or Changed QA Tests

None authored by this QA pass — every high-risk hypothesis already has a conclusive named test or grep-level oracle from the implementation reviews.

## Gaps and Residual Risk

- **INV-CC-8 (coverage gap, non-blocking):** standard-hit field fidelity (`hitCount`/`canCrit`/`canMiss`/`tags`) is silently dropped by the damage adapter — dormant path, deferred to the skill megaplan which owns standard-hit fidelity. Recorded in SDD ledger.
- **INV-CC-6 (residual, Nit):** `combatScheduler` field retains a stale instance across `abandonBattle` — read only at engine construction which re-mints first; harmless while dormant.
- **`rngContract` coverage boundary (Low):** the e2e determinism test doesn't consume the engine's `this.rng` sites (no composite/ailment content fires in its fixture) — consumption-count parity there rests on the 1:1 site mapping + scripted unit tests (e.g. `anKit.test.ts:263` draw-order fails on double-consumption).
- **ScriptedCombatRng domain trust (Nit):** a malformed script could inject out-of-`[0,1]` values — test-only seam, documented intent, no production path.
- Pre-existing bare `Math.random` defaults at `NguKiemDaoProvider`/`HiddenBeastSystem`/`DropRoll` — production always overrides; out of scope.

## Pre-existing Failures

`ChiHienQuan.integration.test.ts` flaked once during M4's full-suite run (unmocked `Math.random` gacha path) — passed isolated and on rerun; pre-existing/environmental, unrelated to this change.

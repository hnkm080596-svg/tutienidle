# QA Review: M7 Final Battle Wiring

- Date: 2026-09-19
- Mode: deep
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/core/battle/runtime/scheduler/CombatOperationBatchRunner.ts`, `src/core/battle/runtime/scheduler/CombatScheduler.ts`, `src/core/battle/turn/TurnBattleSystem.ts`, `src/core/game/GameManagerTurnBattleOps.ts`, `src/core/reaction/ReactionBatchRunner.ts`, `src/core/buff2/BuffPersistence.ts` (comment), `src/core/battle/turn/testing/{FixtureReaction,TurnRuntimeFixtures}.ts`, `src/core/battle/turn/TurnBattleSystem.{contract,determinism,theTuAnRiders}.test.ts`, `src/core/game/GameManager.skillPipelineJourney.test.ts`, `tests/architecture/{combatSchedulerDormancy,damageAuthorityRng}.test.ts`

## Scope and Risk Map

Changed systems: combat scheduler batch frame (new §49 per-op validity gate now shared between the production `runBatchFrame` and the headless `ReactionBatchRunner`), `TurnBattleSystem` (single externalWard write seam + engine-lane dead-code removal), fixture rng binding (`setRandomSource` inside `makeTurnRuntime`), and three new whole-stack test surfaces (contract acceptance, determinism/trace, GameManager production journeys). One-hop consumers: `SkillExecutor` (authored ops through scheduler), reaction dispatcher (fixture batch settlements), `BuffSystem` (selector probe), `CombatSystem` (hit-channel random source). Excluded: docs-only files (inventory, closure matrix, deep-evidence doc, plan/spec status) — no runtime semantics.

Escalation: deep mode mandated by the M7 megaplan (milestone closure). The diff is combat-internal — no save/cloud, economy, inventory, or UI-surface changes; non-combat domain packs checked and found non-loadbearing for this diff.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-M7-01 | Batch frame / CombatScheduler | Op with `targetId`/`selector` field | Gate must not over-skip valid ops or crash on payload shapes | Value mutation | `trace.skippedResults` vs dispatch | Unit/integration | High — a wrong skip silences a payoff |
| INV-M7-02 | runBatchFrame reachability | Handler settlement kind 'batch' | New gate must not alter live production behavior | Reorder | Production handler return types | Integration | High — frame shared across compositions |
| INV-M7-03 | externalWard / TurnBattleSystem | All three grant sites funnel to `writeExternalWardGrant` | Conservation — identical replace semantics | Reorder | `externalWard.sourceId/amount` | Unit | Medium — sourceId tagging drift |
| INV-M7-04 | Deleted engine-lane blocks | `resolveDeclaredHit` callers | No production-reachable behavior removed | Cross-system | Call-site gating audit | Static + suite | High — silent skill semantic loss |
| INV-M7-05 | `setRandomSource` binding | `makeTurnRuntime` per battle | No cross-runtime rng aliasing | Concurrency | Fixture construction audit | Static | Medium |
| INV-M7-06 | `getBuffInstanceBySelector` | Selector kinds instance/identity/target_definition | Probe resolves all kinds without throw, correct holder | Value mutation | `resolveInstance` switch | Unit | Medium |
| INV-M7-07 | Deferred-op path | Materialize → gate ordering | Gate sees materialized op; unresolved prior still skips | Reorder | Frame loop code order | Unit | Medium |
| INV-M7-08 | Result cardinality | Skipped ops record one result | Exactly-once — one result per batch op | Repeat | `BatchResultStore` + trace lanes | Unit | Medium |
| INV-M7-09 | Determinism harness | Same seeded rng to runtime + TBS | Determinism — no Math.random channel left | Determinism | Same-seed parity suite | Integration | High — false parity claim risk |
| INV-M7-10 | Journey survival tuning | Real content + seeded factory | Determinism under real data | Timing boundary | Journey suite rerun | Integration | Medium |
| INV-M7-11 | Periodic/buff batches | `periodic_operation_settled`, `buff_applied` handlers | Gate scope limited to batch settlements | Cross-system | Handler return types | Integration | High |
| INV-M7-12 | `opTargetSkipReason` | `payload` non-object | No TypeError; fault, not crash | Value mutation | `assertResolvedOperationShape` order | Unit | Medium |
| INV-M7-13 | `elemental_application_committed` handler | Fixture registration | No double dispatch with production | Repeat | Handler registration audit | Static | Medium |
| INV-M7-14 | Journey content coupling | Authored repeatCasts/chargeTurns multiplicities | Content drift fails loudly, not silently | Stale state | Assertion shape review | Static | Low |
| INV-M7-15 | Skipped literal shape | `as CombatOperationResult` cast | Consistent with deferred-skip/preflight literals | Type boundary | Type-check + shape compare | Unit | Low |
| INV-M7-16 | Production reaction inertness | No dispatcher/registry/capability in production | Dormancy — fixture-only activation | Cross-system | `ReactionGate.production.test.ts` + grep | Arch test | High |
| INV-M7-17 | `results.record` vs `recordResult` | Skipped-op recording API | Same downstream `prior.status` visibility | Reorder | `BatchResultStore` semantics | Unit | Low |
| INV-M7-18 | identity-selector probe | Selector → `store.find` | Consumed instance resolves undefined → skip | Stale state | `resolveInstance` | Unit | Medium |
| INV-M7-19 | `isAlive` port | Mid-batch death timing | Live `entity.alive`, not a stale snapshot | Timing boundary | Production wiring line 1120 | Unit | High |
| INV-M7-20 | Charge journey oracles | Companion turn log granularity | `chargingSeq` restricted to actor-logged ticks | Stale state | Journey assertion design | Integration | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run verify` (type-check + build + full vitest) | PASS | 683 files / 5821 tests, 4 expected-fail, 0 failures; build clean (1769 modules) |
| `npx playwright test create-to-combat.spec.ts` (serial) | PASS | 2.2m — real character → stage battle → result modal in worktree dev server |
| `npx playwright test turn-combat-hud.spec.ts` (serial) | PASS | 3.5m — battle + slots + refight; parallel-2-worker run failed earlier on RAF starvation (contention, not regression — serial rerun green; both stalled snapshots showed advancing battle at 6/10 quái, identical for both browsers) |
| INV-M7-01 payload-shape audit | RESOLVED | Op payload union is discriminated — every member carries `targetId` XOR `selector`, always `CombatEntityId`; `assertResolvedOperationShape` rejects non-object payloads at frame start (`CombatOperationBatchRunner.ts:404-407`), so `'targetId' in payload` cannot throw |
| INV-M7-02/11 production batch reachability | RESOLVED | Both production immediate handlers (`periodic_operation_settled` → `buffs.handlePeriodicSettled`, `buff_applied` → `gaugeHandler.handleBuffApplied`) return `void` — no production composition mints `{kind:'batch'}` settlements, so `runBatchFrame` and the new gate are inert in production today; the gate is exercised only through the fixture dispatcher (contract suite §95/§96 drive the REAL `runBatchFrame`, so the production code path itself is tested) |
| INV-M7-03 ward-seam equivalence | RESOLVED | `toTurnBattleParticipant` sets `participant.id = entity.id`; all three call sites pass `(actor.entity, target.entity, ratio)` — identical sourceId/amount semantics to the deleted inline writes |
| INV-M7-04 dead-code reachability | RESOLVED | All `resolveDeclaredHit` call sites are engine-lane gated: charge resolve inside `else` of `runtime !== undefined` tri-branch (line ~2022), `engineUnitLane &&` guards (2172/2209), `applyExtraImpact` else-branch (2603). The deleted `runtime !== undefined` block inside it was unreachable by construction |
| INV-M7-05/09 rng binding | RESOLVED | `battleWith` mints a fresh `CombatSystem` per battle and passes the same seeded `CombatRng` to `makeTurnRuntime` (binds `setRandomSource`) AND `TurnBattleSystem` (drives multicast/composite channels) — no unseeded channel remains |
| INV-M7-06 selector probe | RESOLVED | `resolveInstance` handles all 3 selector kinds without throwing; `target_definition` resolves to an instance on the named target (holder unambiguous) |
| INV-M7-07/12 deferred path | RESOLVED | Unresolved prior → `recordDeferredSkip` + `continue` before the gate; `op` at the gate is always a `ResolvedCombatOperation` with validated payload |
| INV-M7-08/15/17 result recording | RESOLVED | One result per op maintained; `record(op, skipped)` is the correct API for materialized/entry ops (deferred entries use `recordResult` since they carry no op) — `prior.status` lookups see both |
| INV-M7-13/16 inertness | RESOLVED | Production registers only `periodic_operation_settled` + `buff_applied` handlers; `elemental_application_committed` registration exists only in `FixtureReaction.ts` (test-only, dormancy-allowlisted); `ReactionGate.production.test.ts` green |
| INV-M7-19 isAlive | RESOLVED | Production wires `isAlive: (id) => resolveParticipant(id)?.entity.alive ?? false` — live flag read per op inside the frame, not a snapshot |
| INV-M7-14 journey coupling | LOW (noted) | Journeys assert authored multiplicities (`repeatCasts` → 3 entries/cast, `chargeTurns` → [2,1]); production content drift fails loudly — acceptable behavioral coupling |
| OCR gate (P18) | PASS | 14/14 reviewable files reviewed (100%); 1 Low (duplicated ctor-arg parser in arch guard) — fixed and committed (`877f9022`); 0 Medium+ |

## Findings

No `Confirmed`, `Suspected`, or `Coverage gap` findings remain. All 20 ledger hypotheses resolved with code-level or runtime evidence.

## New or Changed QA Tests

None — the audit scope is already covered by the task's own acceptance surfaces (`TurnBattleSystem.contract.test.ts` §§91–102 + skill whole-stack, `TurnBattleSystem.determinism.test.ts`, `GameManager.skillPipelineJourney.test.ts`), each verified to exercise the real code path (fixture composition drives the production `runBatchFrame`, not a parallel harness).

## Gaps and Residual Risk

- The §49 per-op gate is production-inert today by design (no production batch settlements); its correctness rests on the fixture-composition coverage of the real `runBatchFrame`. When the seal batch activates the reaction composition in production, this gate becomes live — contract suite §96 already proves the intended semantics on that exact code path.
- Parallel (2-worker) e2e runs starve RAF-driven real-time battles on this machine — a known environment limitation documented in `playwright.config.ts`; serial runs are green and the worktree evidence is valid.

## Pre-existing Failures

None observed — `npm run verify` and both e2e journeys green; the 4 expected-fail tests are baseline-marked.

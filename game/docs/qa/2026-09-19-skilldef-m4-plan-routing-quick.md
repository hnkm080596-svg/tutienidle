# QA Review: skilldef M4 -- LegacySkillAdapter -> SkillResolver -> SkillExecutor -> CombatScheduler routing

- Date: 2026-09-19
- Mode: quick
- Verdict: PASS WITH EVIDENCE (all confirmed findings fixed within the implementation loop; regression tests landed)
- Task-owned paths: `src/core/skilldef/{LegacySkillAdapter,SkillExecutionHooks,SkillExecutor,SkillResolver,AuthoredOperation,ResolvedSkillPlan,ScalarExpression,SkillDefinition,SkillDefinitionRegistry,SkillQueryPorts,SkillProgressionState}.ts`, `src/core/skilldef/{LegacySkillAdapter,SkillExecutor,SkillResolver,SkillSubcast}.test.ts`, `src/core/skilldef/SkillExecutor.testkit.ts`, `src/core/battle/contracts/operations.ts`, `src/core/battle/runtime/scheduler/adapters/{CombatSystemDamageAdapter,EntityResourceAdapter}.ts`, `src/core/battle/turn/{TurnBattleSystem,TurnSkillAction,TurnSkillPlanRuntime}.ts`, `src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts`, `src/core/battle/turn/testing/TurnRuntimeFixtures.ts`, `src/core/game/GameManagerTurnBattleOps.ts`, `src/core/kiem-tu/NguKiemDaoProvider.ts`, `tests/architecture/combatSchedulerDormancy.test.ts`

## Scope and Risk Map

Active, adapter-covered, non-charge turn-combat casts now route through the deterministic plan pipeline; charge/unsupported/unaffordable casts stay legacy. `changed-risk-map.mjs` returned every path as `unmappedPaths` (the map has no `src/core/**` rules) — manual routing: **combat-and-tribulation** domain pack for all 27 paths; one-hop consumers inspected directly (`TurnBattleSystem.applyActionImpact` callers, `mintCycleScheduler` composition roots in `GameManagerTurnBattleOps` and `TurnRuntimeFixtures`, scheduler trace/op-result surfaces). `deepAuditCandidate: false`. No save/cloud, time/offline, economy-transaction, or Vue/Pinia/Phaser lifecycle boundary is crossed — the pipeline is headless and turn-scoped; quick mode is sufficient. Learned-defects ledger: only QA-2026-09-08-RR1 (event cardinality across runtime modes) applies — routed vs legacy lanes must emit equivalent observable results; covered by trace-based routing assertions.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-M4-1 | Cast commit / TurnSkillPlanRuntime.commitShell | One declaring cast commits once; queued executions, composite extras never re-commit | Exactly-once | Repeat | one cost op, one cooldown slot, one `onSkillCast` | integration (`skillPlan.test.ts`) | High — resource/persistence-adjacent |
| INV-M4-2 | Pool resources / EntityResourceAdapter | consume-all burn once at CAST_COMMIT after cost; repeats never burn | Conservation | Repeat | `consume_resource{the,all}` count=1, pool=0 | integration | High |
| INV-M4-3 | RNG stream / resolver+adapter | declared policy rolls identical order/count to legacy per-instance closures | Determinism | Stale state | hit/crit/armor outcomes under fixed rng | unit+integration | Medium |
| INV-M4-4 | Actor/target vitals / resolver target_alive | mid-impact death stops remaining instances and later targets | Lifecycle | Value mutation | dead-source lane mints nothing; second target untouched | integration (`midImpactDeath`) | High |
| INV-M4-5 | Stat refresh boundary / onPlanCompleted | refresh only op-touched participants + source; untouched target vitals never clamp | Boundedness | Cross-system | untouched target currentHp preserved | integration | High |
| INV-M4-6 | Registry / TurnSkillPlanRuntime.catalogFor | shared composite pool members register once; same-id different-shape conflicts fault loudly | Atomicity | Repeat | An basic + special both route; conflicting id stays legacy | integration | High |
| INV-M4-7 | Composite extras / adapter | extras semantics legacy cannot express (non-damaging member, instances, targetScope, appliesBuffs) stay legacy | Synchronization | Value mutation | `unsupported` report; no ops minted | unit (`LegacySkillAdapter.test.ts`) | Medium |
| INV-M4-8 | Adaptation cache / catalogFor | same-id different-shape defs adapt independently (no cross-def contamination) | Stale state | Repeat | per-object catalogs | unit reasoning + type-level | Medium |
| INV-M4-9 | Bookkeeping / session | landed/dodge bookkeeping parity for Tro window, grant gate, log | Exactly-once | Reorder | targetIds/landedTargets content | integration | Low |
| INV-M4-10 | Detonate / executor | consume->burst->reseed mints from one pre-settle snapshot; per-periodic coefficient parity | Atomicity | Value mutation | burst coefficient formula, single reseed per def id | unit (`SkillExecutor.test.ts`) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (type-check + build + full vitest) | type-check + build green; 5755 pass + 4 expected-fail; 1 failure = pre-existing `asciiComments` baseline drift (126 offenders, identical at branch base; zero in task-owned files — my comments verified ASCII-clean by grep) | final post-fix run |
| `npx vitest run src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts` | 12/12 pass — incl. new shared-pool regression | — |
| `npx vitest run src/core/skilldef/` | 133/133 pass — incl. composite-extras gate cases | — |
| `npx vitest run TurnBattleSystem.midImpactDeath + GameManager.statRefresh + skillPlan` | 27/27 pass | — |
| Debug trace (`tmp_sharedpool`, deleted) | `qa_an_basic` routed at step 2 after `qa_an_special` — dedup confirmed end-to-end | temporary harness, removed |

## Findings

### QA-2026-09-19-001: shared composite pool forces the second def permanently legacy
- Severity: Medium
- Status: Confirmed — FIXED (regression test landed)
- Invariant: INV-M4-6
- Preconditions: two loadout defs composite-pick from the SAME `TurnSkillDefinition[]` pool (real: `applyAnKitToBasic`/`applyAnKitToSpecial` both inject `elementPool`).
- Reproduction: cast An special after An basic in one battle; `catalogFor` rebuild included both catalogs' auxiliaries → `duplicate_id` fault → registry constructor throws → catch marks the second catalog unsupported → every later cast stays legacy.
- Expected: shared members dedupe; both defs route.
- Actual (pre-fix): the second def could never route — silent coverage loss (gameplay remained correct via legacy lane).
- Evidence: registry `duplicate_id` fault path (`SkillDefinitionRegistry.ts:233`) + shared-pool injection (`TurnAnKitSkills.ts:42,60`); post-fix debug trace shows `qa_an_basic` minting `skill_hit` at step 2.
- Test file: `src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts` ("routes two casts whose defs share one composite pool")
- Owner subsystem: `TurnSkillPlanRuntime.catalogFor`
- Blast radius: any battle with >=2 defs sharing a composite pool — the entire An kit.

### QA-2026-09-19-002: verbatim composite extras exceed legacy extras-lane semantics
- Severity: Medium (latent — all production pools are `count:1`, no extras exist today)
- Status: Confirmed — FIXED (adapter gate + unit coverage)
- Invariant: INV-M4-7
- Preconditions: `compositePicks.count > 1` AND a pool member is non-damaging / carries `instances` / declares `targetScope` / carries `appliesBuff(s)`.
- Reproduction: routed extras resolve the member verbatim; legacy `applyActionImpact` extras lane only calls `resolveDeclaredHit` on damaging members once per target (skips non-damaging members, drops instance multiplicity, ignores member `targetScope`, and never runs extras' `appliesBuffs` — the shared post-cast lane reads only the primary pick).
- Expected: divergent member shapes stay on the legacy lane.
- Actual (pre-fix): routed extras would silently apply more than legacy.
- Evidence: `TurnBattleSystem.ts:1993-2023` extras lane vs verbatim extra plans.
- Test file: `src/core/skilldef/LegacySkillAdapter.test.ts` ("reports composite extras the legacy lane could not express")
- Owner subsystem: `LegacySkillAdapter.adaptSubcasts`
- Blast radius: authored `count>1` composite pools only — none in production data today.

### QA-2026-09-19-003: id-keyed adaptation cache can bind the wrong adapted shape
- Severity: Low (latent — no current same-id different-shape pair shares one battle)
- Status: Confirmed — FIXED (WeakMap on def object identity)
- Invariant: INV-M4-8
- Preconditions: two distinct `TurnSkillDefinition` objects sharing `id` in one battle (e.g., a kit-mutated copy vs the unmutated original).
- Reproduction (pre-fix): `adapted: Map<def.id>` returns the first-adapted catalog for the second def → it executes the wrong compositePool/subcast shape silently.
- Evidence: `applyAnKitToBasic` returns `{...def, compositePicks, multicast}` under the same id — the id→shape injectivity assumption is unenforced.
- Fix: `WeakMap<TurnSkillDefinition, AdaptedSkillCatalog>` + a `catalogs` list for registry rebuilds (WeakMap is not iterable); only registry-admitted catalogs join rebuilds so an unsupported catalog cannot poison later constructions.
- Test file: none new (hazard eliminated structurally; existing 12 routing tests cover the catalog path)
- Owner subsystem: `TurnSkillPlanRuntime`
- Blast radius: hypothetical same-id multi-shape rosters.

### QA-2026-09-19-004: extras-lane `targetIds` duplicates not reproduced
- Severity: Low
- Status: Coverage gap (deliberate) — documented divergence
- Invariant: INV-M4-9
- Note: legacy's extras lane pushes `targetIds` per extra per target (no dedup); the routed session dedupes globally. `targetIds` reaches only `BattleLogEntry`/`TurnStepResult` telemetry; `resolveAllyActionWindow` dedupes itself. The deduped list is the more correct shape; reproducing legacy's duplicates would copy a bug-shaped artifact. Only reachable for `count>1` composites.

## New or Changed QA Tests

- `src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts` — "routes two casts whose defs share one composite pool (An kit parity)": drives the special then the basic (special on cooldown) and asserts >=2 player-sourced `skill_hit` ops — fails pre-fix because the second catalog faulted `duplicate_id`.
- `src/core/skilldef/LegacySkillAdapter.test.ts` — composite-extras gate cases: non-damaging/instanced/self-scope/appliesBuff members report unsupported at `count>1`; `count:1` and pure-damage pools stay covered.

## Gaps and Residual Risk

- RNG-stream bit-parity between lanes was verified by construction (shared `CombatRng`; `preResolved` skips re-rolls; policy rolls moved into the adapter at the same relative position) — no bit-for-bit dual-run harness exists; flagged as a bounded residual, mitigated by fixed-rng fixture coverage.
- Authored `components` with a single kind at ratio<1 drops the ratio in `toActionDamageInfo` (schema-level malformed-input edge; the resolver never emits it — deferred Nit).
- Full `npm run verify` completed post-fix: type-check + build green, 5755 tests pass, sole failure = pre-existing `asciiComments` baseline drift.

## Pre-existing Failures

- `tests/architecture/asciiComments.test.ts` — 127 offenders at branch base (buff2 files absent on master); baseline drift, not task-caused. The 9 violations inside this branch's own skilldef files were swept.

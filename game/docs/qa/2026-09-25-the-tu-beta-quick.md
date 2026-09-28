# QA Review: the-tu-beta body_pathway redesign

- Date: 2026-09-25
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `src/data/skill/TheTuSkills.ts`, `src/data/buff/TheTuBuffs.ts`, `src/data/progression/TheTuNodes.ts`, `src/data/progression/SkillCoreNodes.ts`, `src/data/skill/TurnSkillDisplayMeta.ts`, `src/core/the-tu/{TheTuPath,TheTuKitModifiers}.ts`, `src/core/player/CultivationPathRegistry.ts`, `src/core/proc/{CombatProcSystem,ProcCapabilities}.ts`, `src/core/battle/{ActionImpactSystem.ts,contracts/operations.ts}`, `src/core/battle/runtime/scheduler/adapters/CombatSystemDamageAdapter.ts`, `src/core/battle/turn/{TurnBattleSystem,TurnSkillAction,TurnSkillPlanRuntime}.ts`, `src/core/combat/{CombatSystem,DamageCalculator,EntityVitalsSystem}.ts`, `src/core/skilldef/{AuthoredOperation,LegacySkillAdapter,SkillDefinitionRegistry,SkillResolver}.ts`, `src/core/simulation/benchmark/BalanceBaselines.ts`, `src/components/panels/{SkillPathPanel.vue,skill-path/TheTuTreePanel.vue}`, `src/locales/{en,vi}.json`, plus the task-owned test files and `docs/specs|docs/balance|docs/qa` docs.

## Scope and Risk Map

Changed systems: combat proc/reflect lane, skilldef plan pipeline (pay_hp op, sourceMaxHpRatio, paid-HP payoff), progression node tree + core grant seam, The Tu kit construction, Vitest fixtures, one Vue panel. One-hop consumers inspected: scheduler damage adapter (deal_damage profiles), TurnSkillPlanRuntime hooks, save-shape validation (D9f inverse membership), balance benchmark matrix. Manual routing (mapper returned all paths unmapped): combat-and-tribulation primary; economy-and-progression (node purchase/gates); save-and-cloud (shape test only — no save mutation change); ui-input-lifecycle (panel). Escalation check: no save-shape/version change, no clock/offline change, no reward/economy transaction; Vue surface is one panel — quick scope is confident.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-1 | pendingReflects / CombatProcSystem | reflect queues per hit, flush once per action | Exactly-once | repeat/multi-hit | one 'reflection' op per holder per action | unit (midImpactDeath) | high — verified |
| INV-2 | pendingReflects lifecycle | entries can never outlive their action | Atomicity | reorder/interrupt | flush is unconditional in applyActionImpact tail; queue only forms inside it | static proof + integration | high — verified (no early return between hit loop and flush; queuedFollowUps are separate actions with reflectsEligible=false) |
| INV-3 | reflect coefficient | holder maxHp x ratio; marked upgrades at flush | Conservation/Boundedness | stale mark | coefficient = holder.stats.maxHp x (marked? markedMaxHpRatio : maxHpRatio), <=0 skips | unit (reflection.test.ts) | high — verified |
| INV-4 | holder/attacker death gates | dead holder or dead attacker skips pending entry | Recoverability | value mutation | flush re-reads liveness at settle | unit (midImpactDeath lethal-2-holder case proves attacker-death skip; holder-death skip observed instrumented) | high — verified |
| INV-5 | reflectsEligible | counter/follow_up/intercept/DoT/env/self never reflect | Exactly-once | cross-system chain | actionSource 'normal'/'skill' gate at onLandedGateEntered | unit (reflection.test.ts terminal test) | high — verified |
| INV-6 | pay_hp ordering | pay first -> new missing-HP -> damage | Atomicity/monotonicity | order | sacrifice op precedes hit ops; ops_result_sum binds ACTUAL paid hp into __paid_hp | unit (theTuBeta) | high — verified |
| INV-7 | sacrifice floor | cost floors at leaving 1 HP | Boundedness | value mutation | adapter: min(maxHp x ratio, currentHp - 1), never negative/self-kill | unit | high — verified |
| INV-8 | cuong_quyen LQ purity | no HP cost, no missing-HP scalar pre-TC | Conservation | stale field | def carries neither field; kit-local bake only via special ownership | unit (TheTuSkills.test.ts) | high — verified |
| INV-9 | tran_ap Max-HP authority | sourceMaxHpRatio adds caster maxHp x ratio to raw base | Conservation | value mutation | adapter toActionDamageInfo + pin tests | unit | high — verified |
| INV-10 | root mutex | cuong_chien XOR tran_the; persists | Monotonicity | repeat/reload | excludesNode + nodeLevels persistence tests | unit (way tests) | high — verified |
| INV-11 | balance gate | exit-2 per-recipe strengths/weaknesses | Determinism | regression | fingerprints + per-recipe verdict pinned; deviation documented | benchmark | high — RECORDED DEVIATION (by design: LQ Thể Tu is basic-only) |
| INV-12 | D9f inverse membership | every owned core_* needs a legal source | Recoverability | stale save | majors grant via grantsSkillCoreIds; bat_tu_ba_the unreachable in beta | unit (saveShapeValidation) | high — verified |
| INV-13 | multicast repeats vs reflect | each repeat is its own declared action | Exactly-once | repeat | per-action flush per repeat — reflect fires once per repeat | static reasoning | medium — semantics accepted (repeat == separate hostile action) |
| INV-14 | __paid_hp var collision | two sacrifice defs in one composite share var name | Conservation | concurrency | sequential op order means each pay->read pair is adjacent | static reasoning | low — accepted (single authored user; sentinel never author-addressed) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run` scoped dirs (data/{skill,progression,buff}, core/{the-tu,game,battle,skilldef,stats,simulation}, services/save) | 294 files / 2816 tests green | Full task surface |
| `npm run type-check` | clean | vue-tsc build |
| `npx eslint` changed files | clean | 13 unused-import errors fixed |
| Instrumented `applyActionImpact` run (midImpactDeath fixture) | reflect queued per hit, fired once at flush; holder-death and attacker-death skips observed | Direct runtime observation |
| `TurnBattleSystem.reflection.test.ts` | 12/12 green incl. once-per-action, AoE trigger, ward/dodge no-trigger, no-recursion, marked ratio | Written this task |

## Findings

No Confirmed defect remains. Two behaviors were classified as intended-design findings rather than defects:

- The pre-refactor per-hit reflect could kill an attacker mid-impact (stopping remaining hits). The beta design's "max ONE reflect per hostile ACTION (multi-hit settles first)" makes mid-impact reflect death impossible BY DESIGN; T3-22b tests were rewritten to the new contract (full settle, one reflect per holder, post-action kill). The `!actor.entity.alive` mid-loop guards remain for other kill lanes.
- `takenRatio` (taken-damage reflect fraction) is retired: TheTuBuffs.ts header documents it, `TheTuBuffs.test.ts` pins `'takenRatio' in reflect === false`, no authored def used it. QA defs in midImpactDeath were migrated to maxHpRatio.

### QA-2026-09-25-01: pending-reflect flush skips dead holders (dead holder cannot retaliate)
- Severity: Low
- Status: Suspected (semantic choice, not a defect)
- Invariant: recoverability
- Evidence: instrumented run — enemy1 died on hit 2 before flush, its pending entry dropped; actor survived
- Owner subsystem: combat/proc
- Blast radius: a reflect-holder killed mid-action reflects nothing — matches design intent (nothing in design requires posthumous reflect)

### QA-2026-09-25-02: TheTuTreePanel.vue not runtime-verified
- Severity: Low
- Status: Coverage gap
- Evidence: type-check + eslint only; no browser/Playwright pass on the panel in this session
- Owner subsystem: UI
- Blast radius: presentation only; combat/progression behavior unaffected

## New or Changed QA Tests

- `TurnBattleSystem.midImpactDeath.test.ts` — rewritten to the beta reflect contract (full settle, once-per-holder flush, lethal post-action kill); proves INV-1/INV-4.
- `TurnBattleSystem.reflection.test.ts` — new 12-test suite pinning Phản Chấn reflect semantics.
- `TurnBattleSystem.theTuBeta.test.ts` — new suite pinning sacrifice ordering, 1-HP floor, paid-HP payoff, kit-local Huyết Cuồng scope, Trấn Áp Max-HP scaling, taunt+mark AoE application.
- `TheTuPath.way.test.ts`, `LegacySkillCoverage.test.ts`, `saveShapeValidation.test.ts`, `BalanceMatrix.test.ts`, `deadIds/surviveOpIds` QA pins — migrated to beta ids/contracts.

## Gaps and Residual Risk

- UI panel rendering not exercised at runtime (coverage gap, QA-2026-09-25-02) — coordinator's integration pass should eyeball the two-root card UI once.
- Multicast-repeat reflect semantics rely on "each repeat is a separate declared action" — consistent with existing architecture, noted for the coordinator.
- `criticalRate` live-stat drift forced one invariant to precision 3 — documented in the test comment.

## Pre-existing Failures

- `UNROUTED_CAST` warning noise for `aoe_test` in the charge-resolve path (charged routed cast falls through to the normal lane which declines `isCharging` actions) — pre-existing harness noise at origin/master, unrelated to this task.

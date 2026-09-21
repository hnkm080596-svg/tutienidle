# QA Review: P7-M3 Canonical Technique Authority

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/technique/**`, `game/src/core/game/{BattleLootSystem,GameManagerBattleRewardOps,GameManagerAutoFarmOps,GameManagerRealmAdvanceOps,GameManagerSaveRestore,GameManagerPersistentEffectOps,GameManagerRewardOps,EarlyGameBootstrap}.ts`, `game/src/data/technique/Techniques.ts`, `game/src/data/{enemy,drop,quest}/**`, `game/src/core/{player,kiem-tu,phap-tu,the-tu,reward,drop,enemy,quest,tribulation,cultivation,artifact,skill}/**` touched files, `game/src/components/**` touched files, `game/src/composables/{useTechniqueSections,useLoadoutActions}.ts`, `game/src/services/save/**`, `game/src/App.vue`, and their migrated test files (170 total).

## Scope and Risk Map

M3 replaces the learned-list/insight Technique system with the canonical single-holder model (grade/rank/mastery/quality), way-owned grant at initiation, victory-only pending mastery with per-cycle auto-farm settle, the Nâng Cảnh material transaction, the quest `techniqueInsight -> skillInsight` channel rename, and save v70 hard preflight.

Risk-mapper output: 6 domains (combat-and-tribulation, economy-and-progression, pinia-phaser-sync, save-and-cloud, time-and-offline, ui-input-lifecycle), `deepAuditCandidate: true`.

**Escalation decision (bounded-risk rationale):** quick mode retained because every mandatory-escalation surface received a decisive oracle, not just inspection: (a) save/recovery — the v70 preflight's every rejection branch was inspected and the live v70 round-trip was observed (save persisted + reloaded during the runtime session); the rejection contract itself is the pre-existing `version !== CURRENT` mechanism; (b) economy transaction — the grade advance is a single synchronous op inspected end-to-end with all-fail-before-spend ordering proven; (c) offline/time — auto-farm mastery inherits the shared per-cycle runner both callers already used. No hypothesis remained at "materially risky" after checks. Per quick-review.md the mapper flag is advisory when code inspection + runtime evidence confidently bounds the risk; M2's save-boundary mission used the same precedent.

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Layer | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-M3-1 | `GameManagerRealmAdvanceOps.chooseCultivationPath` | Way pick at mortal cap → promotion + canonical grant | Atomicity — all-or-nothing; grant AFTER realmId write | Reorder / interruption | Pre-commit checks for technique+skill+passive templates and EMPTY holder (:163-197) precede `applyPathChoice`; `realmId='qi_refining'` :247 precedes `grantCanonicalTechnique` :269; live run: `qi_refining:1` + `sword_control_art` | code + browser | No defect |
| INV-M3-2 | `GameManagerSaveRestore.preflightSaveRegistryReferences` | v70 restore | Recoverability — mortal=0, way=exactly matching id, bounded state | Value mutation | :163-198 reject non-1 count / wrong id / unknown template / non-integer or out-of-range grade(1..ceiling)/rank(0..10)/mastery(<cost when rank<cap, ==0 at cap)/quality | code + boundary tests | No defect |
| INV-M3-3 | `BattleLootSystem.pendingTechniqueMastery` | kills accumulate; victory terminal settles | Exactly-once — consume-and-zero; repeat policy `preserveLootSession` keeps session across cycles | Repeat | `settleTechniqueMastery` reads+zeros pending before `gainMastery` (:184-198); `rewardOnceGuards` reset per repeat cycle so each victory terminal fires once | code + mastery tests | No defect |
| INV-M3-4 | `GameManagerAutoFarmOps.rollAutoFarmCycleReward` | tick + offline settle per cycle | Exactly-once per cycle | Repeat / timing boundary | Both callers loop `rollAutoFarmCycleReward` (:233-235, :304-306) which ends in `settleTechniqueMastery()` (:356) | code | No defect |
| INV-M3-5 | pending buffer on defeat | battle defeat | Conservation — defeat pays nothing | Terminal ordering | settle is inside the `victory` branch only (:150-155); `beginBattle` zeros pending on next fresh battle (:172) | code | No defect |
| INV-M3-6 | `tryAdvanceTechniqueGrade` | Nâng Cảnh transaction | Atomicity + Conservation — no spend without advance | Reorder / interruption | Guard order: holder → `canAdvanceTechniqueGrade` (rank cap + realm ceiling) → combat states → cost resolve → bag amount → `remove` → `advanceTechniqueGrade` (cannot fail post-guards; synchronous) (:325-347) | code + live disabled-state | No defect |
| INV-M3-7 | pending accumulation `+= rewards.techniqueMastery` | kill reward | Boundedness — no NaN into holder → save | Value mutation | `EnemyReward.techniqueMastery: number` required; `resolveDrops` always emits finite (`:168-170` defaults 0); `Math.floor` of finite product | code | No defect |
| INV-M3-8 | shared `battleLoot` session | auto-farm `beginBattle()` mid manual battle | Synchronization — no cross-wipe | Concurrency | Unreachable: `stageManager` single slot — `startAutoFarm` fails while slot held, manual stage can't acquire while farm holds it; `tickAutoFarm` fail-closes on `owns(farmLease)` | code | No defect |
| INV-M3-9 | `getSkillInsightReward` / quest channel | enemy + quest rewards | Conservation — 0.6 derivation preserved; quests pay `skillInsight` | Cross-system | `SKILL_INSIGHT_PER_TECHNIQUE_MASTERY = 0.6`, `skillInsight` field takes precedence; quests renamed to `skillInsight` (15/120/200 same amounts) delivering via `RewardSystem.addSkillInsight`; live: mastery +68 → insight +41 | code + browser | No defect |
| INV-M3-10 | `loadGame` version gate | v69 payload | Recoverability — pre-cutover rejected | Stale state | `version !== CURRENT(70)` → `incompatible`; literal v69 rejection test added (QA write, M2 convention) | unit | No defect |
| INV-M3-11 | `restoreFromSave` technique slice | restore | Synchronization — authored data re-derived, state preserved | Stale state | :233-266 clone → template re-derives name/description/icon/element/resourceLabel/combatTypeId/gradeEffects/combatModifiers; persisted grade/rank/mastery/quality survive | code + live reload | No defect |
| INV-M3-12 | `TechniquePanel` / consumers | render + affordance | Lifecycle/Synchronization — holder-driven UI | Stale state | All consumers on `getActive()` (zero `getEquipped` residue); live: `Sơ Nhập · Cảnh 1`, `Cấp 0 · 0/300`, `Hoàng Chất`, `ĐANG TU LUYỆN`, `Nâng Cảnh — 200 Hạ phẩm Linh Thạch (0)` disabled | browser | No defect |
| INV-M3-13 | `gainMastery` cap | mastery beyond rank cap | Conservation — consume only needed, discard tail, `gained`=consumed | Value mutation | `needed = cost*(cap-rank) - mastery`; `consumed = min(amount, needed)`; cap zeroes mastery; `gained=consumed` feeds summary honestly | unit tests | No defect |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (full) | 709 files / 6204 tests green (4 expected-fail), type-check + build clean | post-implementation full suite |
| P18 OCR | Clean — 166 reviewable files, 0 Medium+ | all production diffs verified vs locked spec |
| Runtime (worktree dev :5910) | v70 save boots; mortal `techniques:[]`; ritual → `qi_refining:1` + `sword_control_art` holder (`grade:1,rank:0,mastery:0,hoang`) on `sword:sword_pathway`; panel renders holder + Nâng Cảnh affordance; dong_1 victory `+68` mastery → persisted `mastery:68`, `+41` skillInsight; 0 console errors | interactive browser session |
| `npx vitest run src/services/save/saveVersion.test.ts` | 4/4 green incl. new literal v69 rejection | QA-added test |
| `gainMastery`/settle boundary tests (`BattleLootSystem.techniqueMastery.test.ts`) | green | pre-existing in diff |

## Findings

None — no `Confirmed`, `Suspected`, or `Coverage gap` findings. The mapped high-risk hypotheses each resolved with conclusive evidence.

## New or Changed QA Tests

- `game/src/services/save/saveVersion.test.ts` — added literal v69 rejection case (`PRE_M3_VERSION = 69`), matching the M2 convention of pinning each mission's concrete cutover boundary even though the mechanism (`version !== CURRENT`) is already covered.

## Gaps and Residual Risk

- Grade advancement is unreachable at `qi_refining` (ceiling = realm index 1) — the Nâng Cảnh affordance stays disabled until realm index ≥ 2; this is the spec'd ceiling semantics, verified as intended, not a defect.
- `EnemyReward.techniqueMastery` amounts on mortal enemies accrue pending but settle to `gained: 0` for holder-less mortal players — silent discard is per spec (mortals hold no technique).
- EarlyGameSession: removal of `tu_linh_quyet` moved the canonical grind wall earlier; re-characterized as an expected-fail with balance tuning deferred to M4 (documented in the test file, not a QA finding).

## Pre-existing Failures

- `dongFuBackgroundAssets.test.ts` timed out once under full-suite load earlier in the session; passed in focused runs (78 tests) — load flake, not task-caused.

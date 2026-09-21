# P6-M0 — Early Progression Loop Inventory & Gap Census

Plan: `docs/superpowers/plans/2026-09-23-early-progression-loop-closure.md`.
Evidence: `src/core/simulation/M0LoopProbe.test.ts` (temporary probe tracing the
real loop through production seams; replaced by `EarlyGameSession` in M1).

## 1. Loop trace (probe evidence, seed 11, pinned profile)

Pinned profile: `hap_linh` + str2/vit3 (5 attribute points) — no cultivation
speed, insight, economy, or tribulation subsidy.

| Step | Seam exercised | Result |
|---|---|---|
| Bootstrap | `learnTechnique`/`equipTechnique`/`learnSkill`/`setSkillLoadoutSlot` (replicating `App.vue::onNewCharacter`) | mortal:1, tram in slot 0, linh_bao/huy_quyen learned unequipped |
| mortal_dong_1 attempt 0 | `turnBattleOps.startStage(player, stage)` + `ManualClockSource.advance` | **defeat** at mortal:1 — honest data, +37 skillInsight from combat accrual |
| Grind + retry | `addCultivation`→`breakthrough` then `startStage` again | **victory** at mortal:2 — loop closes: defeat → cultivate → breakthrough → win |
| Cultivation ladder | `getRequiredCultivation`/`addCultivation`/`breakthrough` | mortal:2→16 chain unbroken |
| mortal_dong_2 | `isStageUnlocked` (realmLevel-gated) + `startStage` | unlocked at high mortal level, victory, `completedStageIds` settled via reward path |
| Quan Khí | `startTribulation(player,'qi_refining')` + `tickOps.update(1)` + `tribulationDirector.answerQuestion` | victory, committed outcome `{grade:'human'}`, no battle object |
| Ritual | `realmAdvanceOps.chooseCultivationPath('kiem_tu','hien')` | true → `qi_refining:1`, path+way stamped, +attribute points |
| qi_refining_forest | `startStage` | **defeat** at qi_refining:1 — post-ritual floor needs node/insight investment |
| Node purchase | `progressionOps.purchaseNode('orb_dam_1')` | true, `skillInsight` 123→122 — positive-cost spend proven |

Verdict: **the loop closes end-to-end on real seams.** Every transition
rewarded, gated, or purchased through its production owner. No placeholder
state encountered.

## 2. Seam inventory

| Step | Owner | Production seam | Session call |
|---|---|---|---|
| Catalog registration | `catalogOps` | `registerSkillTemplates/TechniqueTemplates/ProgressionNodes/EnemyTemplates/Stages` | same as `BattleSimulation` |
| Bootstrap | `GameManager` ops | `realmAdvanceOps.learnTechnique/equipTechnique`, `progressionOps.learnSkill/setSkillLoadoutSlot` | shared bootstrap op (M1) |
| Cultivation | `player.ts` action → extract | **`cultivateTick(player, dt)` (M1 extraction)** — preserves talent speed, realm ramp, timed modifiers, `totalCultivationGained`, `accrueCultivationInsight` | shared op |
| Minor breakthrough | `CultivationSystem` | `breakthrough(player)` after `getRequiredCultivation` | same |
| Stage entry | `GameManagerTurnBattleOps` | `startStage(player, stage)`; gates via `isStageUnlocked` | same |
| Battle drive | combat clock | `setCombatClockSource(ManualClockSource)` + `setBattleRngFactory(SeededCombatRng)` | same as `BattleSimulation` |
| Reward settlement | `GameManagerBattleRewardOps` | `grantBattleRewardIfNeeded()` on combat-over — loot, `completedStageIds`, battle_end once, stage lease release | automatic via clock |
| Quan Khí | `TribulationDirector` | `startTribulation` + `tickOps.update` + `answerQuestion` + committed outcome | same |
| Ritual | `CultivationPathSystem` | `realmAdvanceOps.chooseCultivationPath(path, way)` — atomic path+way | same |
| Node spend | `NodeSystem` | `progressionOps.purchaseNode(nodeId)` — `orb_dam_1` is the qi_refining hien growth root (cost 1) | same |
| Insight income | `accrueCultivationInsight` + per-cast accrual | observed: +37 on a lost fight (cast accrual), cultivation insight via tick | via `cultivateTick` |
| Currency | — | Linh Thạch is NOT on `PlayerData`; battle loot routes `battleLoot.processDefeatedEnemies` → `materialBag` | read via `materialBag` public surface |

## 3. Nondeterminism census

| Source | Site | Owner | Seam | Decision |
|---|---|---|---|---|
| `Math.random` combat rolls | `TurnBattleOps` default `FunctionCombatRng` | turn-battle ops | `setBattleRngFactory(SeededCombatRng)` | seeded per session |
| `Math.random` loot/alchemy/pill | `battleLoot.processDefeatedEnemies` et al | loot/economy | **none — deliberately unseeded** ("a seeded battle must not pin drops") | M2: normalize material drops out of fingerprint; assert only settled `completedStageIds`/counters, or add an economy-RNG seam via the loot owner if the plan requires deterministic loot |
| `Math.random` Van Dao waive | `NodeSystem.rollVanDaoWaive` | node system | gated by `getNodeCostFreeChance(talentIds)` | pinned `hap_linh` profile ⇒ chance 0 ⇒ never reached. Recorded; no seam needed |
| `crypto.randomUUID` enemy ids | `EnemySystem` spawn (`${template.id}_${uuid}`) | enemy system | none | normalize: entity ids excluded from fingerprints |
| `crypto.randomUUID` building ids | `BuildingSystem.add`, `App.vue` bootstrap | building system | caller supplies `instanceId` | M2: session-owned fixed identity provider at the bootstrap seam |
| `Date.now` battle duration | `turnBattleStartedAtMs`, `clearSeconds` perfect-clear | turn-battle/reward ops | none | normalize: durations/perfect-clear timestamps excluded |
| `Date.now` tribulation cooldown | `TribulationDirector.cooldownUntil` | tribulation | `getCooldownSeconds(now)` gates re-entry | M2 decision: single-attempt sessions unaffected; retry path needs a clock seam on the director |
| `clock.nowSeconds` | combat clock, building `lastCollectedAt` | building/clock | `ManualClockSource` / fixed clock | injected |
| `lastSavedAt` | save metadata | save system | — | normalized out of regression comparisons |

## 4. Gaps found

1. **No production-neutral bootstrap exists.** `App.vue::onNewCharacter` mixes
   core ops (technique/skill learning, loadout, starter buildings via
   `crypto.randomUUID`, starter materials, production auto-restart) with
   app wiring (`setActivePlayer`, autosave). M1 extracts a shared bootstrap
   receiving an already-valid creation profile; building-instance identity
   needs the fixed-id seam.
2. **No production cultivation tick seam.** `player.ts::cultivate()` bundles
   speed calc + timed modifiers + write + insight accrual inside the Pinia
   action. M1 extracts `cultivateTick(player, deltaSeconds)` used by both.
3. **Loot RNG has no seam** (by design). Fingerprint normalizes material
   drops; `completedStageIds`/insight/node counters are the settled surface.
4. **Tribulation retry is wall-clock gated** (`cooldownUntil` on Date.now).
   Single-victory sessions unaffected; document or seam if retry coverage is
   added.
5. **Post-ritual floor 1 is not free** — qi_refining_forest defeats a fresh
   `qi_refining:1` kiem_tu/hien. The session must run the post-ritual loop
   (insight → node purchase → cultivate → retry) rather than expect a win.

## 5. M1 implications

- `EarlyGameSession` = persistent `GameManager` + `ManualClockSource` +
  `SeededCombatRng` + shared bootstrap + step primitives (`cultivate`,
  `runStage`, `runTribulation`, `ritual`, `purchaseNodes`, `snapshot`).
- `cultivateTick` extraction is the first code change (TDD: preserve
  `player.ts::cultivate` semantics byte-for-byte through the shared op).
- Pinned profile validated at the integration boundary (service-side), then
  handed pre-validated to the session — no `core/simulation → services` edge.

## 6. M2 findings (2026-09-21) — canonical loop evidence

`EarlyGameSession` + `EarlyGameLoop` landed: persistent GameManager +
ManualClockSource + seeded combat RNG + loot-RNG seam, full production
catalog registration (mirrors `App.vue`), step primitives as a closed
union, `CANONICAL_EARLY_LOOP` script, deterministic snapshot reporting.

What the loop proves green:
- Fresh bootstrap through the pinned profile (no subsidy).
- Mortal floors 1-7 clear **at their realmLevel gate** — the
  grind→breakthrough→retry loop works exactly as designed.
- `growth_cycle` (farm best-cleared → equip → refine → allocate)
  exercises the real gear/refinement economy: +hundreds of equipment
  drops, tinh-hoa tiers 1-3 fill, attribute points spend.
- Zone chain is **linear**: `qi_refining_forest` requires
  `mortal_dong_10` — the canonical script was corrected to the real
  10-floor mortal chain (the earlier "2 floors" script was testing an
  unregistered-zone artifact).
- Drops roll `realmLevel = player.realmLevel` at drop time; the bag
  fills across bands as the player levels.

**The wall (balance finding, parked):** `mortal_dong_8` — the first
ferocious-tier floor (17 enemies: `mortal_ferocious_silver_fox`/
`mortal_ferocious_iron_boar`, 180-288hp, might 16-22, armor 13-17) —
defeats a player who has exhausted every mortal growth system. Evidence
at seed 7/11: ~12/17 kills per attempt across mortal:8-18, tram lv1→lv2,
refinement tiers 1-3, all 6 slots equipped, strength AND vitality specs.
The floor-7→8 enemy jump is only ~15% (not a data cliff); the gap is the
mortal power ceiling vs a 17-enemy war of attrition (player hp ~135-150
vs cumulative chip damage). Mortal precursor skills (`tram`/`linh_bao`/
`huy_quyen`) are blocked from loadout slots, so `tram` is the fixed
basic — no defense-piercing `linh_bao` lever exists for mortals.

Parked per user direction (2026-09-21): balance work paused pending a
new plan. The canonical-loop test is pinned as characterization evidence
(asserts the loop clears 1-7 and the wall is exactly dong_8); flip to
`toBeNull()` when the ferocious tier or mortal power curve is retuned.

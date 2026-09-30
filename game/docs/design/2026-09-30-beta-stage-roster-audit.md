# BETA SCOPE LOCK v2 Phase-4 — stage-facing enemy roster audit + plan

Date: 2026-09-30. Branch base: `origin/devin/beta-scope-v2` (8932adc5).
Scope: rewrite stage pools to the final 12-identity beta roster, allow-list
in the stage domain data, difficulty via count/waves/elite/combat
modifiers, stage read-model for frontend, elemental fairness hook.

## 1. How floors pick species today

- `data/stage/Stages.ts` authors three `ChapterConfig` literals
  (mortal / qi_refining / foundation_establishment). Each declares
  `speciesByFloor: { common, elite }[10]` — ~20 distinct species per
  chapter, roughly two new species every 1-2 floors. This is the pattern
  the scope lock removes.
- `data/stage/ChapterStages.ts#defineChapterStages` builds each floor:
  `enemyPool = [{common, w5}, {elite, w3, eliteChance: 0.1}]`,
  `bossEnemyId = species.elite` on floor 10 only,
  `totalEnemyCount = 9 + floor`, `waves` split evenly in 3
  (floor 10 raw `[total]`; `effectiveWaves`/`effectiveTotalEnemyCount`
  apply the solo-boss override downstream), `spawnIntervalSeconds = 3`,
  `perfectClearTurnLimit = total + 10` normal / `15` boss.
- `poolOverrides` exists as an escape hatch (today only Quat 1's
  4-species tutorial pool uses it). Under the scope lock an override is
  a leak vector — it gets removed, not patched.

## 2. The spawn funnel (all stage spawns)

`StageWaveSystem.pickEnemyForSpawn` is the ONLY producer of stage
enemies. Both channels flow through it:

- active turn battle: `GameManagerTurnBattleOps` wave `spawnEnemy`
  factory -> `pickEnemyForTurnSpawn` (allowTags: true)
- idle auto-farm cycle: `GameManagerAutoFarmOps.rollAutoFarmCycleReward`
  -> `pickEnemyForTurnSpawn` (allowTags: false)

Inside it, in order:

1. `floor === 10 && isFinalSpawn && bossEnemyId` -> `createBossVariant`
   (+ optional tinh_anh stack at the boss pool entry's eliteChance).
2. `stageSystem.pickNextEnemyEntry` — weighted pool roll; the rolled
   entry's `eliteChance` attaches the `tinh_anh` tag via
   `applyEnemyTags` -> `applyEliteMultiplier` (x2.5 HP / x1.35 might /
   x1.15 def / x1.1 acc + `isElite` flag + `Tinh Anh ` prefix). Elite is
   ALREADY a runtime modifier — exactly the "Hung = modifier+aura+tint,
   not identity" the spec wants.
3. `hiddenBeast.maybeReplaceSpawn` — **bypasses the pool**: with the
   1000-kill qi_refining window open it substitutes `huyet_mong` (a
   HIDDEN_BEASTS template, not in any pool) at 5%/spawn. This is the one
   leak path: a non-pool enemy entering a stage encounter.

`enemy.level` is authored metadata (stats come from `statsInput`); there
is no per-floor level-scaling machinery — difficulty today is count +
wave shape + the species ladder itself.

## 3. Elemental fairness today

Boss defensive resistance is element-specific in two layers:

- authored: all 3 beta bosses resist only `water`
  (`mortal_ferocious_giant_crocodile` water 8, `ferocious_flood_serpent`
  water 20, `foundation_ferocious_flood_dragon_whelp` water 20 via
  `foundationBeast({element, resistance})`).
- `applyBossMultiplier` adds `BOSS_RESISTANCE_BONUS` (+15) **only to the
  boss's own element** (`xPower > 0` gate) — pinned by
  `EnemyStatInput.test.ts` (fire boss: fire 15 / wood 0).

Result: spawned bosses carry water-only resistance (23/35/35) and 0
everywhere else — water-element players are singled out. `createBossVariant`
is only reached from `pickEnemyForSpawn` (stage floor-10 spawns);
tribulation/hidden bosses are authored `isBoss` and never pass through
it, so the multiplier only ever touches stage bosses.

## 4. Read-model today

`catalogOps` owns `isStageUnlocked` (realm gate + zone-order gate) and
`stageLockReasonCode` (display-ready reason). The frontend
(`StageSelectPanel.vue`) still reconstructs everything else itself:
zone unlock (first-stage probe), node enemy names (raw `enemyPool` ->
template lookup), boss flag (`bossEnemyId`), perfect-clear
(`perfectClearStageIds`), auto-farm armed/eligible
(`autoFarmStage`, `perfectClearSeconds`), start availability
(zone + stage unlock re-derivation). Auto-farm eligibility proper lives
in `GameManagerAutoFarmOps.resolveValidAutoFarmStage` (private):
perfect-cleared + valid persisted cycleSeconds + resolvable stage.

## 5. Leak census (what must change)

| Path | Leaks today | Fix |
|---|---|---|
| `enemyPool` roll | ~60 pool ids across 30 stages | roster bands (pure) |
| `bossEnemyId` | floor-10 elites of old pairs | act bosses only |
| hidden-beast substitution | `huyet_mong` into qi stages | gate on stage-declared spawn set |
| `poolOverrides` | arbitrary ids | removed |
| dormant `ENEMIES` (~50 templates) | reachable via pool only | stay in catalog, unreachable |

## 6. Plan

1. **`ChapterStages.ts`** — replace `speciesByFloor`/`poolOverrides`
   with `roster: { normals: [A, B, C], boss: string }` (validated: 3
   distinct normals + 1 boss). Floor bands: 1-3 -> A, 4-6 -> B,
   7-9 -> C, 10 -> boss. Pool = `[{enemyId: band, weight: 1,
   eliteChance}]`; floor-10 pool = `[{boss, weight: 1,
   eliteChance: 0.1}]` preserving the spec-v3 10% boss+tinh_anh stack.
   `bossEnemyId` stays floor-10 only. Count/waves/spawn/perfectClear
   rules unchanged.
2. **`Stages.ts`** — 12-id rosters per spec; floor descriptions
   re-authored so each band's text names only its roster species.
   Stage ids/names/zone order frozen (saves key on them).
3. **Difficulty dial** — `eliteChanceForFloor(floor)` ramps
   `0.05 + (floor - 1) * 0.02` (5% -> 21%) on floors 1-9; floor 10 keeps
   0.1 (boss+tinh_anh stack). This + the existing 9+floor count ladder +
   wave split is the authored difficulty; species are authored at
   band-appropriate levels already, so no per-floor level channel is
   added (flagged for Phase-8 balance matrix).
4. **Funnel** — new `core/stage/StageSpawnableEnemies.ts`:
   `stageSpawnableEnemyIds(stage)` = pool ids + `bossEnemyId`. The
   hidden-beast substitution in `pickEnemyForSpawn` fires only when the
   substituted id is spawnable for that stage — shipped stages never
   declare a hidden beast, so the substitution cannot fire on beta
   stages while the channel mechanism stays intact (matching Phase-1
   `hiddenContent: false`; template/channel data preserved for
   post-beta).
5. **Read-model** — new `GameManagerStageOps` exposed as
   `gameManager.stageOps`, strictly additive:
   `getStageSurfaceModel(stageId, player)` /
   `getStageSurfaceModels(player)` returning
   `{ stageId, act, realmId, floor, state, isBossFloor, displayEnemy,
   rewardPreview, autoFarmAvailable, startAvailable, disabledReason }`.
   - `state`: `perfect` > `completed` > `current` > `available` >
     `locked` — `current` = first unlocked-uncompleted stage in zone
     order (the resume/frontier node).
   - `disabledReason`: the existing `stageLockReasonCode` union plus
     `{ kind: 'busy' }` when the single stage slot is held.
   - `startAvailable`: delegates to `stageWaves.canStart` (the real
     admission probe) — no duplicated gate.
   - `autoFarmAvailable`: delegates to a new public
     `autoFarmOps.isAutoFarmStageEligible` (thin public wrapper over
     the existing private eligibility contract — one authority).
   - `rewardPreview`: built from `stageDropTableFor` (currency ranges,
     guaranteed + pool item ids, weights stripped).
   - `displayEnemy`: boss template on floor 10, else the single pool
     species, resolved through `enemyTemplates`.
6. **Elemental fairness** — `applyBossMultiplier` grants
   `BOSS_RESISTANCE_BONUS` uniformly on all five elements (drop the
   own-element gate); the 3 beta bosses' authored `resistances` become
   uniform-5 at current magnitude (8/20/20). Spawned bosses then carry
   identical resistance on all five elements. Flagged for Phase-8.
7. **Tests** — new `data/stage/BetaStageRoster.test.ts` census:
   3 chapters x 10 floors, band mapping, 3 distinct normals + 1 boss per
   chapter, exactly 12 identities, every pool/boss id on the roster,
   adversarial no-off-roster-id-in-any-stage sweep, boss mechanics
   preserved (serpent water_surge everyNth 4, whelp 50%/25% phases +
   enrage + special, croc special), funnel test (hidden substitution
   dead on roster stages, alive on fixture stage declaring the beast).
   Honest updates: `Stages.test.ts` (ferocious-even test and the
   eliteChance-count pin), `ChapterStages.test.ts` fixture,
   `GameManager.hiddenChannel.test.ts` (fixture declares huyet_mong in
   pool), `EnemyStatInput.test.ts` (uniform boss resistance),
   `GameManager.perfectClear.feasibility.test.ts` (roster fixture).
8. **Open questions** — kill quests targeting `bandit` /
   `foundation_stone_fungus` / `foundation_flood_dragon_whelp` are now
   unreachable-in-beta (Phase-1 `isBetaQuestEnabled` scope-hides
   off-roster kill quests — handled by the authority module, not this
   phase). Phase-1 `betaScope.ts#BETA_ENEMY_ROSTER` is the canonical
   cross-domain roster; the stage-domain roster here is the funnel
   authority for stages — a merge-time dedup is a natural cleanup once
   PR #82 lands.

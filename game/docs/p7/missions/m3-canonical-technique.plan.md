# P7 — M3 Plan: Canonical Technique Authority

Status: PLAN_PASS (ChatGPT review; 4 findings fixed in v2).
Spec: `m3-canonical-technique.spec.md` (SPEC_PASS, v8).
Base: M2 `cca7f91b` on `feat/p7-progression-consolidation`, worktree `.agent-worktrees/p7-progression-consolidation`.

## Execution notes

- TDD order: write/adjust failing tests first per task, then implement, then re-run the touched scope.
- This is a large rename + model replacement across ~134 test-touching files. Keep changes mechanical; behavior deltas are ONLY the four spec §4.12 items (mortal loses tu_linh_quyet stats; spell grade-2 earned not instant; defeat pays no mastery; mortal earns no mastery) plus thai_hu_kiem_quyet retirement.
- Save version bumps 69 → 70 — same rejection mechanism, no translator.
- i18n keys UNCHANGED (M1 contract) — `combat.rewards.techniqueInsight` stays the key; only the summary field it reads is renamed.
- All edits inside the worktree. Local commit only after all gates pass.

## Task 0 — G0/G1 evidence

- Task card: mission-graph M3 + spec v8 §3 scope list (16 bullets).
- Measured facts (re-verified on `cca7f91b`):
  - `chooseCultivationPath` order today (RealmAdvanceOps:147-262): guards → way resolve → preflight (technique/skill/passive templates) → `applyPathChoice` (path/way/slice) → `learnTechnique`+`equipTechnique` (:196-197) → skill unequip/learn/equip → passiveSkillIds → `if mortal` realm promotion (`realmId='qi_refining'` :243) + `markQuestRealmTransition` + `syncRealmPassive`/`syncRealmStatPassive`. **The grant currently runs while realmId is still 'mortal'** — the plan moves it after the promotion so `grant(template, player.realmId)` reads `qi_refining`.
  - `grantCultivationPathRealmReward` (CultivationPathSystem:365-399): sole caller `TribulationOutcomeService:233` via the RealmAdvanceOps facade (:67-74) which builds the 4-field `CultivationPathRewardDeps`. `reward.techniqueId` path does learn+insight-carryover+equip.
  - `BreakthroughOutcomeService` (:102-117): documented-dead major-realm branch containing the `dai_ngu_hanh_quyet_truc_co` swap; context interface (:65-71) carries `techniqueManager`/`learnTechnique`/`equipTechnique`; context = RealmAdvanceOps `this` (:101).
  - Auto-farm (`GameManagerAutoFarmOps`): no TurnBattle — `rollAutoFarmCycleReward` (:320-357) calls `beginBattle`→`setChannel('idle')`→`setSession`→`processDefeatedEnemies`; called per cycle by `tickAutoFarm` (:304-306) and `settleAutoFarmOffline` (:233-235). Eligibility = `perfectClearStageIds` + valid cycleSeconds (:65-75).
  - Repeat cycle (`BATTLE_CYCLE_POLICIES.repeat`): `preserveLootSession: true` → `beginBattleCycleCommitted` SKIPS `battleLoot.beginBattle()` (:1602-1604); summary accumulates across cycles → `settleTechniqueMastery` must consume pending.
  - Victory terminal: `GameManagerBattleRewardOps.grantTurnBattleRewards` (:119-165), `battleEndEmitted` once-guard, victory branch at :150.
  - Reward plumbing: `Reward.techniqueInsight`/`RewardReceiver.addTechniqueInsight` (quest channel); `EnemyReward.techniqueInsight` (required, ~45 enemy entries); `EnemyReward.skillInsight?` optional override; `getSkillInsightReward` derives ×0.6 from `techniqueInsight`; `getArtifactExperienceReward` reads `enemy.rewards.techniqueInsight` (ArtifactProgression:66); `BattleRewardSummary.techniqueInsight`; `StageDropTable.currency.techniqueInsight` (3 ranges 5-8/35-45/90-120); `resolveDrops` returns `techniqueInsight` (:168); `dropSampling.techniqueInsightPerKill`; `BenchmarkEncounters.BASE_REWARDS` (:31).
  - TechniqueManager API: `add/remove/get/getAll/restore/getEquipped/has` (:6-40). TechniqueSystem: `learn/equip/unequip` (:7-57). `getEquipped` callers: PersistentEffectOps (:151,172), RewardOps (:70), BattleLootSystem (:274), CultivationPathSystem (:381), BreakthroughOutcomeService (:112), TechniqueSlotCard (:54), TechniquePanel (:29).
  - `useTechniqueSections.buildTechniqueSections(technique, insight)` reads `tierEffects[getTechniqueTier(insight, total)]`; callers pass `technique.insight`.
  - Save: `save.techniques` shape-validated by `validateIdEntries` (id-string only, :1202); restore re-derives `name/description/tierEffects/combatModifiers` (:184-211), drops unknown ids; `preflightSaveRegistryReferences` (:100) is the hard-fail seam.
  - `ItemQuality = 'hoang'|'huyen'|'dia'|'thien'|'tien'` + `ITEM_QUALITY_LABELS`/`ITEM_QUALITY_ORDER` (`core/item/ItemQuality.ts`); `getRealmIndex` (`realmSystem.ts:93`); `getSpiritStoneMaterialIdForRealmTier` (SpiritStoneMaterial:50, tier<4→ha_pham); `materialBag.getAmount`/`remove` pattern at RealmAdvanceOps:369-374.
  - Boot grants: `App.vue:550-551`, `EarlyGameBootstrap.ts:49-50`.
  - Way `techniqueId` refs: KiemTuPath:176 `ngu_kiem`, :225 `van_kiem_quyet`; PhapTuPath:212 `dai_ngu_hanh_chan_quyet`, :248 realmRewards `dai_ngu_hanh_quyet_truc_co`, :315 `ngo_dao_chan_quyet`; TheTuPath:209 `kim_cang_bat_hoai_the`, :257 `ung_the_than_quyet`.
- Cycle constraint (same as M2): `TechniqueProgression.ts` is a leaf module — core imports it; it imports only types + `realmSystem`/`SpiritStoneMaterial`/`ItemQuality` helpers (all leaf-level; no cycle).

## Task 1 — `TechniqueProgression.ts` leaf module + failing tests

New `src/core/technique/TechniqueProgression.ts` (absorbs `TechniqueTier.ts`'s survivors; `TechniqueTier.ts` deleted in Task 3):

```ts
export const TECHNIQUE_RANK_CAP = 10
export const BASE_RANK_MASTERY = 300
export function getTechniqueMasteryForNextRank(grade: number): number { return BASE_RANK_MASTERY * grade }
export function getTechniqueTierForRank(rank: number): TechniqueTier  // >=6 vien_man, >=3 dai_thanh, >=1 tieu_thanh, else so_nhap
export function getTechniqueEffects(technique: Technique): TechniqueTierEffect | undefined
  // highest authored gradeEffects[g] with g <= technique.grade; band = getTechniqueTierForRank(rank)
export function getTechniqueGradeCeiling(realmId: string): number { return getRealmIndex(realmId) }
export function canAdvanceTechniqueGrade(technique: Technique | undefined, realmId: string): boolean
  // !!technique && rank >= CAP && grade < ceiling
export function getTechniqueGradeUpgradeCost(targetGrade: number, realmId: string): { materialId: string; amount: number }
  // { getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId)), 100 * targetGrade }
export const TECHNIQUE_TIER_LABELS: Record<TechniqueTier, string>   // moved verbatim
```

`TechniqueProgression.test.ts` (new — TDD red):
- cost: grade1→300, grade2→600.
- band map: 0/1/3/6/10 → so_nhap/tieu_thanh/dai_thanh/vien_man/vien_man.
- ceiling: mortal→0, qi_refining→1, foundation_establishment→2, body_integration→7, mahayana→8, unknown→-1.
- effects: grade table resolution + fallback (no authored g2 → g1 table at grade 2).
- canAdvance: rank<10 false / at ceiling false / ok true.
- upgrade cost: foundation grade2 → `{spirit_stone_ha_pham, 200}`; grade3 → `{spirit_stone_ha_pham, 300}` (extensible rule pinned).

## Task 2 — `Technique` model rewrite

`src/core/technique/Technique.ts`:
- Keep `TechniqueTier`, `TechniqueTierEffect` types (vocabulary survives). Add `TechniqueRankBandEffects = Partial<Record<TechniqueTier, TechniqueTierEffect>>` — actually keep the existing `Partial<Record<TechniqueTier, TechniqueTierEffect>>` inline shape; no new type name needed.
- `Technique` fields: `id, name, description, icon?, element?, resourceLabel?, combatTypeId?, combatModifiers?` + **required** `grade: number, rank: number, mastery: number, quality: ItemQuality` + `gradeEffects?: Partial<Record<number, Partial<Record<TechniqueTier, TechniqueTierEffect>>>>`.
- Remove: `insight`, `insightMultiplier`, `tierEffects`, `unlocked`, `equipped`, `requiredRealmId`, `requiredRealmLevel`.
- Comments: rewrite the file header — P7-M3 canonical model (rank/mastery/grade/quality per D1/D8/D9).

## Task 3 — `TechniqueManager` 0-or-1 + `TechniqueSystem` rewrite + tests

`TechniqueManager`:
```ts
private active: Technique | null = null
getActive(): Technique | undefined          // replaces getEquipped — update ALL callers
setActive(technique: Technique | null): void
get(id): Technique | undefined              // active?.id === id ? active : undefined
has(id): boolean
getAll(): Technique[]                       // active ? [active] : [] — save snapshot compat
restore(entries: Technique[]): void         // this.active = entries[0] ? structuredClone(entries[0]) : null (validated <=1 upstream)
```
Drop `add`, `remove`, `getEquipped`. `remove` has no production caller after this mission — do not keep a dead method (check tests; if a test needs clearing use `setActive(null)`).

`TechniqueSystem`:
```ts
grant(template: Technique, realmId: string): boolean
  // slot: active===null -> set; active.id===template.id -> true (defensive noop); else false
  // ceiling: template.grade > getTechniqueGradeCeiling(realmId) -> false
  // init: {...template, grade: template.grade, rank:0, mastery:0, quality: template.quality}
gainMastery(amount: number): { gained: number; rankUps: number }
  // needed = cost*(10-rank) - mastery; consumed = min(amount, needed)
  // mastery += consumed; while mastery>=cost: rank++, mastery-=cost
  // returns { gained: consumed, rankUps }
advanceTechniqueGrade(): boolean   // !active || rank<CAP -> false; grade++, rank=0, mastery=0
setTechniqueQuality(quality: ItemQuality): boolean  // !active -> false; ITEM_QUALITY_ORDER includes -> write
```
Remove `learn`/`equip`/`unequip`.

Tests (new `TechniqueSystem.test.ts`, delete `TechniqueTier.test.ts`):
- grant: empty-slot init values; same-id noop true; different-id false (active preserved); `'mortal'` realm refuses (ceiling 0); unknown realm refuses (ceiling -1).
- gainMastery: partial accrual; single/multi rank cascade; mid-call cap crossing consumes `needed` only, `mastery===0` at rank 10, `gained`=consumed, tail discarded; at-cap `{0,0}` and mastery stays 0; idempotent repeat.
- advanceTechniqueGrade: rank<10 false; rank10 → grade+1/rank0/mastery0.
- setTechniqueQuality: writes; `ITEM_QUALITY_ORDER` member only.
- manager: 0-or-1 (`getActive`/`get`/`has`/`getAll`/`restore`≤1/`setActive(null)`).

## Task 4 — `Techniques.ts` re-author (6 defs)

Rewrite `TECHNIQUES` to exactly six entries with D12 ids; each carries `grade:1, rank:0, mastery:0, quality:'hoang'` and `gradeEffects` (old `tierEffects` → `gradeEffects[1]`):

| id | name | source table | extra fields |
|---|---|---|---|
| `five_elements_art` | 'Tiểu Ngũ Hành Quyết' | chan_quyet g1 + truc_co g2 (FOLD) | icon dai_ngu_hanh path, resourceLabel 'Pháp Lực' |
| `dao_insight_art` | 'Ngộ Đạo Chân Quyết' | ngo_dao g1 | icon dai_ngu_hanh path, resourceLabel 'Pháp Lực' |
| `sword_control_art` | 'Ngự Kiếm Tâm Kinh' | ngu_kiem g1 | icon ngu_kiem path, combatTypeId 'crit', element 'metal' |
| `myriad_swords_art` | 'Vạn Kiếm Quyết' | van_kiem g1 | icon van_kiem path |
| `diamond_body_art` | 'Kim Cang Bất Hoại Thể' | kim_cang g1 | icon iron_body path, combatTypeId 'def' |
| `responsive_body_art` | 'Ứng Thế Thần Quyết' | ung_the g1 | icon iron_body path, combatTypeId 'def' |

`name`/`description` carried verbatim from current defs. Drop `tu_linh_quyet`, `dai_ngu_hanh_quyet_truc_co` (folded into `five_elements_art.gradeEffects[2]`), `thai_hu_kiem_quyet`. Header comment rewritten (P7-M3 catalog).

## Task 5 — Way modules + realm-reward contract

- `KiemTuPath.ts`: `techniqueId: 'sword_control_art'` (:176), `'myriad_swords_art'` (:225).
- `PhapTuPath.ts`: `techniqueId: 'five_elements_art'` (:212), `'dao_insight_art'` (:315); `realmRewards.foundation_establishment` → `{ artifactId: 'ngu_hanh_chau' }` (compose merge keeps canonical passive — the M2 mechanism is untouched).
- `TheTuPath.ts`: `techniqueId: 'diamond_body_art'` (:209), `'responsive_body_art'` (:257).
- `CultivationPathKit.ts`: `CultivationPathRealmReward.techniqueId` field removed (:70 region).
- `CultivationPathSystem.ts`: `CultivationPathRewardDeps` + `deps` param deleted; `grantCultivationPathRealmReward(player, realmId)` = way/record resolve → `reward.artifactId && !player.artifact → createDefaultArtifactProgress` → `return true`.
- `RealmAdvanceOps.grantCultivationPathRealmReward` facade: drop deps block → `grantPathRealmReward(player, realmId)`.
- `BreakthroughOutcomeService`: remove the dead technique-swap block (:111-117); context interface drops `techniqueManager`/`learnTechnique`/`equipTechnique` (RealmAdvanceOps still satisfies it structurally).
- `CultivationPathContract.test.ts`: update the realmRewards record contract — `artifactId !== undefined || passiveSkillId !== undefined`; `way.techniqueId` resolves in `techniqueTemplates`; pin `TECHNIQUES` = the six D12 ids; `five_elements_art.gradeEffects[2]` exists (fold pin).
- `RealmPassiveLadder.test.ts`: the merge/passthrough fixtures using `techniqueId` must swap to `artifactId` (techniqueId no longer a legal record field — the compose type changes with the record type).

## Task 6 — `GameManagerRealmAdvanceOps` + boot grants

- Remove `learnTechnique`/`equipTechnique`/`unequipTechnique` (:104-126) and their facade uses.
- Add `grantCanonicalTechnique(techniqueId: string, player: PlayerData): boolean` — template resolve → `techniqueSystem.grant(template, player.realmId)`.
- `chooseCultivationPath` changes:
  - preflight additions: `this.techniqueManager.getActive() === undefined` (empty-holder D9 contract — a mortal holding any technique is corrupt → reject pre-commit); `getTechniqueGradeCeiling('qi_refining') >= techniqueTemplate.grade` (defensive).
  - Atomicity test (explicit `it` in the ritual/technique grant suite): mortal player with a pre-existing technique in the holder → `chooseCultivationPath` returns `false` AND `cultivationPath`, `cultivationWay`, `realmId`, `realmLevel`, and all path-state slices are deep-equal to pre-call snapshots (no partial commit).
  - **Reorder:** move the technique grant from its current position (:196-197, realm still mortal) to AFTER the `if (player.realmId === 'mortal')` promotion block (after :259, before `return true`): `this.grantCanonicalTechnique(way.techniqueId, player)`. The grant then reads the committed `qi_refining` realm.
- Add `tryAdvanceTechniqueGrade(player: PlayerData): boolean` — mirrors `tryUpgradeArtifactGrade` (:295): `const technique = techniqueManager.getActive(); if (!technique || !canAdvanceTechniqueGrade(technique, player.realmId)) return false;` combat guard (intro/countdown/fighting) → cost via `getTechniqueGradeUpgradeCost(technique.grade + 1, player.realmId)` → `materialBag.getAmount(id) < amount` → false → `materialBag.remove(id, amount)` → `techniqueSystem.advanceTechniqueGrade()`.
- `tryAdvanceTechniqueGrade` test matrix (dedicated `it`s, using the artifact op's test pattern):
  - combat states (intro/countdown/fighting) → false, zero mutation;
  - `rank < 10` → false, zero mutation;
  - `grade >= ceiling(realmId)` → false, zero mutation;
  - insufficient stones → false, zero mutation AND zero material loss;
  - exact-cost case: 200 `spirit_stone_ha_pham` at foundation target-2 → consumed exactly 200, grade 2/rank 0/mastery 0;
  - failure leaves technique object identity + fields untouched (snapshot compare).
- `App.vue` (:550-551) + `EarlyGameBootstrap.ts` (:49-50): delete the `tu_linh_quyet` learn/equip lines (skill grants stay).

## Task 7 — Reward channel renames

- `Reward.ts`: `techniqueInsight?: number` → `skillInsight?: number`.
- `RewardSystem.ts`: `RewardReceiver.addTechniqueInsight` → `addSkillInsight`; `give` routes `reward.skillInsight → receiver.addSkillInsight`.
- `Player.ts createPlayerRewardReceiver`: `addSkillInsight` closure; JSDoc reword.
- `GameManagerRewardOps`: `buildPlayerRewardReceiver` — the insight closure becomes `(amount) => { player.skillInsight += amount; player.totalSkillInsightGained += amount }` (mirrors the battle inline path); DELETE `gainEquippedTechniqueInsight`, drop `techniqueManager` dep + `getTechniqueInsightTotalRequired` import.
- `Enemy.ts`: `EnemyReward.techniqueInsight` → `techniqueMastery` (+ comment); `skillInsight?` stays the authored override.
- `SkillInsightBalance.ts`: `getSkillInsightReward` reads `reward.techniqueMastery`; `SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT` → `SKILL_INSIGHT_PER_TECHNIQUE_MASTERY` (value 0.6 unchanged).
- `ArtifactProgression.ts:66`: `enemy.rewards.techniqueMastery` (+ comment).
- `BattleRewardSummary.ts`: `techniqueInsight` → `techniqueMastery`; `BattleRewardItemKind` drops `'technique'`; comments.
- `quests.ts`: the 3 entries → `{ reward: { skillInsight: 15|120|200 } }`; `Quest.ts:37` comment.
- `DropTable.ts`: `DropKind` loses `'technique'`; `StageDropTable.currency.techniqueInsight` → `techniqueMastery`.
- `resolveDrops.ts`: return field + roll → `techniqueMastery` (:168).
- `StageDropTables.ts`: `currency.techniqueMastery` (3 ranges unchanged).
- `dropSampling.ts`: `techniqueInsightPerKill` → `techniqueMasteryPerKill` + internals.
- `BenchmarkEncounters.ts:31`: `{ techniqueMastery: 0, spiritStone: 0 }`.
- Enemy data (`MortalEnemies`/`FoundationEnemies`/`HiddenBeasts` + any test fixtures): `rewards.techniqueInsight` → `techniqueMastery` — mechanical rename, values unchanged.

## Task 8 — `BattleLootSystem` pending + victory/idle flush

- Deps: drop `techniqueManager`, `techniqueTemplates`; keep `techniqueSystem`.
- New `private pendingTechniqueMastery = 0`; `beginBattle` resets it.
- `processDefeatedEnemies` per-kill block:
  - `rewards` object: `{ spiritStone: floor(drops.spiritStone × stoneMultiplier), techniqueMastery: floor(drops.techniqueMastery × realmRewardMultiplier) }`.
  - `this.pendingTechniqueMastery += rewards.techniqueMastery` — NOT delivered here.
  - `giveReward(this.receiver, { spiritStone: rewards.spiritStone })` — pass ONLY the spiritStone field so no Reward-field collision with EnemyReward.skillInsight overrides (skillInsight stays on the existing inline path with the talent multiplier; unchanged).
  - Remove `insightBeforeReward`/delta-read/`summary.techniqueInsight` block and the per-kill insight particle.
  - skillInsight inline path (getSkillInsightReward→talent multiplier→player.skillInsight/totalSkillInsightGained/summary) unchanged.
- New `settleTechniqueMastery(sourceId?: string)`: `const amount = this.pendingTechniqueMastery; this.pendingTechniqueMastery = 0; if (amount <= 0) return; const { gained } = this.deps.techniqueSystem.gainMastery(amount); this.summary.techniqueMastery += gained; if (gained > 0 && sourceId) this.emitRewardParticle(sourceId, 'insight', 0x78e6d0)` — consume-and-zero (repeat cycles skip beginBattle).
- `grantResolvedDrops`: delete the `case 'technique'` block (:601-617).
- `GameManagerBattleRewardOps.grantTurnBattleRewards`: inside the victory branch (:150) → `this.deps.battleLoot.settleTechniqueMastery(turnBattle.players[0]?.entity.id)` — after `bankPassiveCarry`, before/parallel to `recordPerfectClearIfEligible`.
- `GameManagerAutoFarmOps.rollAutoFarmCycleReward`: `this.deps.battleLoot.settleTechniqueMastery()` after `processDefeatedEnemies`, inside the try (before finally restores channel) — both `tickAutoFarm` and `settleAutoFarmOffline` inherit per-cycle delivery.

Tests:
- `BattleLootSystem` mastery test: kills → pending grows, summary.techniqueMastery stays 0 during 'fighting'; `settleTechniqueMastery` delivers via `techniqueSystem.gainMastery` spy, summary += gained, pending 0; second settle no-ops (consume pin).
- `GameManagerBattleRewardOps` victory: kills + state='victory' → mastery delivered once + summary set; kills + state='defeat' → 0 delivered, summary 0; repeat-cycle victory pays only that cycle's kills.
- `autoFarm` test: `rollAutoFarmCycleReward` delivers per cycle; offline settle delivers per completed cycle.
- Drop tests: `resolveDrops.test.ts` technique-kind fixtures (:130,:158) → remove/repurpose to 'material'; `resolveDrops.gating.qa.test.ts` — the `'technique'` assertion fixture updates.

## Task 9 — `PersistentEffectOps` + comment sweep

- `getTechniqueTierModifiers` → read `techniqueManager.getActive()`; `effect = getTechniqueEffects(technique)`; emission identical (modifier ids `technique-tier:{id}:{stat}`, sourceType 'technique', spell-domain gate unchanged).
- `getTechniqueCombatModifiers`: `getActive()` + drop the `?.equipped` check (equipped field gone — active IS equipped).
- Comment sweep (wording only): `CultivationTick.ts:68`, `Player.ts:148`, `SkillSystem.ts:361`, `PassiveSkills.ts:431`, `useLoadoutActions.ts:29`, `TechniqueCodex.vue` header (learn-by-drop mechanism gone — browsing 6 canonical defs), `BattleLootSystem` header + :184 comment (victory-gate note → mastery pending note), `Enemy.ts` reward comments, `Quest.ts:37`, `GameManager.grantRandomEquipmentDrop.test.ts:59`, `GameManager.turnManualQa.test.ts:121`, `KiemTuState/NguKiemDao/NodeBranchViews/StatDomain/TurnSkillDisplayMeta/kiemBarBridge/KiemTuNodes/MortalEnemies` — any `techniqueId`/insight comment refs caught by the residue sweep.

## Task 10 — UI

- `TechniqueSlotCard.vue`: `getActive()`; band label `TECHNIQUE_TIER_LABELS[getTechniqueTierForRank(rank)]`; bar = `mastery / getTechniqueMasteryForNextRank(grade)` (rank 10 → full); label line `Cảnh {grade} · Cấp {rank}` + `ITEM_QUALITY_LABELS[quality]`; tooltip `buildTechniqueSections(technique)`.
- `useTechniqueSections.ts`: `buildTechniqueSections(technique)` (drop the insight param — `getTechniqueEffects(technique)` internally); update both call sites.
- `TechniquePanel.vue`: `getActive()`; add the grade-transaction affordance — when `canAdvanceTechniqueGrade(technique, player.realmId)`: a "Đột Phá Tâm Pháp" button showing the cost (`{amount} × {material name}` via `getTechniqueGradeUpgradeCost` + materialRegistry name) → `gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)` (minimal surface; M7 redesigns). Player access via `usePlayerStore()` + `player.$state` — the `QuanKhiPanel.vue:41,116` pattern.
- `TechniqueCodex.vue`: `TECHNIQUES` browses 6 defs; `owned = manager.has(id)`; header comment update.
- `RewardList.vue`/`CombatDefeatPanel.vue`: `summary.techniqueMastery` (i18n key `combat.rewards.techniqueInsight` UNCHANGED).

## Task 11 — Save v70 + contract

- `saveVersion.ts`: `CURRENT_SAVE_VERSION = 70` + v70 comment block (P7-M3: technique snapshot = grade/rank/mastery/quality; 0-or-1 way-owned contract).
- `preflightSaveRegistryReferences` (`GameManagerSaveRestore.ts`): new techniques block AFTER existing checks — resolve way via `getActiveWayDefinition(save.player)` semantics:
  - way → `save.techniques.length === 1 && save.techniques[0].id === way.techniqueId`, else throw (wrong-id/unknown-id/multi-entry all throw — no silent drop);
  - no way → `save.techniques.length === 0`, else throw;
  - field checks per entry: `Number.isInteger(grade) && 1 <= grade <= getTechniqueGradeCeiling(save.player.realmId)`; `Number.isInteger(rank) && 0 <= rank <= 10`; `Number.isInteger(mastery)` + `rank<10 → 0 <= mastery < cost(grade)` + `rank===10 → mastery === 0`; `ITEM_QUALITY_ORDER.includes(quality)`; template registered (throw, not drop — the owned entry is data).
  - Update the comment at :118-122 — techniques ARE now included (registry-drift principle upgraded to identity-contract validation).
- Restore loop (:184-211): keep flatMap but the preflight guarantees count+identity — re-derive `name/description/icon/element/resourceLabel/combatTypeId/gradeEffects/combatModifiers` from template; persisted `grade/rank/mastery/quality` untouched; `techniqueManager.restore` accepts ≤1.
- `saveShapeValidation.ts`: `validateIdEntries` for techniques stays (id presence); deep contract lives in preflight (needs registries + way catalog).
- `saveVersion.test.ts`: v69 rejection test (raw `version: 69` payload — same pattern as the v68 test added in M2); `SaveSystem.restoreIdentity.test.ts:81` technique fixture → new required fields.
- Dedicated preflight rejection matrix (extend `GameManagerSaveRestore.preflight.test.ts` or new `techniqueContract` suite) — one `it` per case:
  - way save + `techniques` length 2 → throws;
  - way save + wrong (registered but non-way) id → throws;
  - way save + unregistered id → throws;
  - way-less (mortal) save + 1 entry → throws;
  - way-less save + 0 entries → passes;
  - valid way save + canonical entry → passes;
  - `grade` non-integer / 0 / > `getTechniqueGradeCeiling(player.realmId)` → throws;
  - `rank` non-integer / < 0 / > 10 → throws;
  - `mastery` non-integer / < 0 / >= `cost(grade)` at rank<10 → throws;
  - rank 10 + `mastery !== 0` → throws;
  - `quality` not in `ITEM_QUALITY_ORDER` → throws.

## Task 12 — GameManager wiring + residue sweep

- `GameManager.ts` constructor: `battleLoot` deps — remove `techniqueManager`/`techniqueTemplates` (:621-623); `rewardOps` deps — remove `techniqueManager` (verify no other RewardOps use); `BattleRewardOps` already has `battleLoot`; `autoFarmOps` unchanged (`battleLoot` dep suffices).
- `battleLootTestSetup.ts`: mocks — `techniqueSystem: { gainMastery: vi.fn().mockReturnValue({ gained: <amount arg>, rankUps: 0 }) }`; REMOVE `techniqueManager` and `techniqueTemplates` from the battleLoot deps mock (Task 8 removes them from `BattleLootSystemDeps` — the mock must match the new interface exactly); other deps in the shared fixture keep their existing mocks.
- Residue sweep (must end at zero live refs): `tu_linh_quyet`, `dai_ngu_hanh_chan_quyet`, `dai_ngu_hanh_quyet_truc_co`, `ngo_dao_chan_quyet`, `ngu_kiem`, `van_kiem_quyet`, `kim_cang_bat_hoai_the`, `ung_the_than_quyet`, `thai_hu_kiem_quyet`, `insightMultiplier`, `tierEffects`, `getEquipped\b` (technique), `learnTechnique`, `equipTechnique`, `unequipTechnique`, `techniqueInsight`, `getTechniqueInsightTotalRequired`, `getTechniqueTierProgress`, `BASE_TECHNIQUE_INSIGHT_REQUIRED`, `TECHNIQUE_TIER_COST_SHARES`, `addTechniqueInsight`, `TechniqueTier.ts` file, `'technique'` DropKind.
- Allowed residual hits: historical comments (like M2), icon asset paths (`/assets/techniques/ngu_kiem.png` stays a leaf filename — do NOT rename assets), the `five_elements_art`-adjacent i18n/locale keys (check: do technique ids appear in locale files? grep `dai_ngu_hanh` in src/locales — if display names are keyed by id they stay leaf per M1 i18n contract).

## Task 13 — Test suite migration

Beyond the new tests in Tasks 1/3/8/11, sweep affected suites:

- `GameManager.cultivationPathRewards.test.ts`: spell foundation reward → artifact-only (true, grants `ngu_hanh_chau`, no swap — update from M2's technique-grant expectations).
- `GameManager.realmPassiveSkill.test.ts` (M2 file): ritual now yields canonical art — update `equipTechnique('ngu_kiem')` assertions to `getActive()`/new ids; the "equip does not learn passive" pin becomes "grant does not learn passive".
- `phapTuAnPath.test.ts`, `cultivationRitualFlow.integration.test.ts`: technique id references → new ids.
- `useTribulation.dotPha.test.ts`: technique grant/swap expectations → artifact-only + canonical art state.
- `useAppLifecycle.test.ts`: `tu_linh_quyet` bootstrap refs → remove.
- `RewardList.test.ts`/`CombatVictoryPanel.test.ts`/`CombatDefeatPanel.test.ts`: `techniqueInsight` → `techniqueMastery` summary fields.
- `ArtifactProgression.test.ts`, `Enemy*` tests, `dropCharacterization`, `dropSampling` tests: `rewards.techniqueInsight` → `techniqueMastery`.
- `battleCycle.test.ts`/`bossRepeatCycle`/`battleEndPublication`/`autoFarm*` tests: any insight expectations → mastery/pending semantics.
- `DebugTurnRewards.test.ts`, `grantRandomEquipmentDrop.test.ts` (comment), `turnManualQa.test.ts` (comment), `saveShapeValidation.test.ts`, `SaveMigration.test.ts`, `SaveSystem*.test.ts` fixtures: Technique object literals gain `grade/rank/mastery/quality` required fields (drop `unlocked`/`equipped`).
- `InkWashMediumSurfaces.test.ts`, `turnCombatReactivity`, `TurnBattleSystem*` etc. — mechanical fixture updates.
- `TribulationOutcomeService`/`BreakthroughOutcomeService` tests: dead-branch + deps-field removals.
- `EquipmentSystem`/`EquipmentBag` tests — only if they construct technique fixtures (grep).
- `startAStage.ts` fixture + `battleLootTestSetup.ts` (Task 12).
- `useTechniqueSections` consumers: `TechniqueSlotCard`/`TechniquePanel` callers — update call signature.

## Task 14 — Balance oracle + full gates

- Run `npm run verify` — the four §4.12 deltas WILL move the fingerprint (mortal loses tu_linh stats; spell g2 earned; defeat pays 0; mortal mastery 0). Diagnose, regen fingerprint + dated `docs/balance/` delta report per the oracle contract.
- P18 OCR over the diff; P13/P14 runtime matrix (sword ritual → canonical art + grade-1 band modifiers live; spell → Trúc Cơ: `five_elements_art` unchanged id, `ngu_hanh_chau` artifact, no swap; rank-10 → Đột Phá button → 200 ha_pham → grade 2 effect row; defeat path pays 0 mastery; auto-farm pays per cycle); P4 QA; ≥3 P5 passes; external IMPL review; local commit.

## Risk notes

- **Grant reorder** (Task 6): grant moves after realm promotion — nothing between the old and new positions reads the technique (skill/passive grants don't consult it; `syncRealmPassive` reads way.realmRewards only). Verified: `learnSkill`/`equipToSlot`/`equipWithoutSlot`/`markQuestRealmTransition`/`computeBreakthroughGrade`/`mortalPerfectionAchieved` don't touch technique state.
- **`getEquipped` rename**: every caller switches to `getActive()` — the rename is total (no alias) so a missed caller is a compile error, not a silent wrong path.
- **`Reward`/`EnemyReward` field collision**: `giveReward` now receives `{ spiritStone }` only — `EnemyReward.skillInsight` authored overrides can never leak through the Reward receiver path.
- **PreserveLootSession consume**: `settleTechniqueMastery` zeroes pending before the API call — a `gainMastery` throw leaves pending 0 (fail-safe: don't re-pay).
- **`structuredClone` on grant**: template → instance copy (same detach semantics as the old `learn`).

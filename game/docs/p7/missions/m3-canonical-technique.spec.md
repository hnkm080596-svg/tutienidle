# P7 — M3 Spec: Canonical Technique Authority

Status: DRAFT v8 — pending ChatGPT review (v1: 7; v2: 4; v3: 2; v4: 3; v5: 1; v6: 1; v7: 1 — Number.isInteger pinned on rank/mastery/grade).
Authority: `docs/p7/mission-graph.md` M3; `docs/p7/decisions.md` D1 (hybrid rank/grade), D7 (victory-only mastery), D8 (quality axis), D9 (realm-derived ceiling), D12 (semantic English ids), D13 (ops model); `docs/p7/system-inventory.md` §2 (REPLACE/FOLD/RETIRE rows), F3/F4.
Depends on: M1 (`ce32f140`), M2 (`cca7f91b`) — way-owned `realmRewards` with composed passive ladder in place; save version 69.

## 0. Locked product decisions for this spec (user, 2026-09-21)

- **Quest `techniqueInsight` grants** → converted to `skillInsight` at the same amounts (15/120/200). D7 forbids non-victory mastery sources; the quests keep an insight-themed reward in the separate Skill/Node pool.
- **Per-rank mastery cost** = `300 × grade` (grade 1: 300/rank reproducing today's thresholds exactly; grade 2: 600/rank — "higher art is slower" preserved).
- **Grade transaction cost** = 200 spirit stones at the **current realm tier's denomination** (`getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId))` — foundation → `spirit_stone_ha_pham`). Extensible rule: `100 × targetGrade` — the minimal linear rule through the locked point (grade 2 → 200; future grade 3 → 300). No new technique material; `doan_bao_thach` stays artifact-scoped.

## 1. Problem

Technique authority is split across four mutually inconsistent ideas (inventory F3):

1. **Way canonical technique** — granted at the ritual from `way.techniqueId` (correct owner, wrong persistence/equip story).
2. **Realm-swap variant** — `spell_pathway.realmRewards.foundation_establishment.techniqueId` swaps `dai_ngu_hanh_chan_quyet` → `dai_ngu_hanh_quyet_truc_co` with `Math.max` insight carryover (F4: exists *only* because the model cannot express "same art, higher grade").
3. **Universal starter** — `tu_linh_quyet` learned+equipped at boot for every mortal (`App.vue:550-551`, `EarlyGameBootstrap.ts:49-50`) — locked for complete removal.
4. **Learn-by-drop library** — `DropKind 'technique'` + `grantResolvedDrops` case teaches arbitrary catalog entries; **already data-dead** (no authored drop-table entry exists).

The progression model is insight-share tiers (`insight` accumulates 0→`insightMultiplier×1000`; bands at 0/10/30/60% shares). D1/D7/D8/D9 replace it: `mastery`→`rank` auto-progression to a cap, transacted `grade`, independent `quality`, realm-derived grade ceiling. Technique ids are VN leaf names on the identity spine — D12 renames the six canonical arts to semantic English `_art` ids.

## 2. Current state (measured, M2 commit `cca7f91b`)

| Surface | Today | Reads |
|---|---|---|
| `Technique` fields | `id, name, description, insight?, insightMultiplier?, icon?, requiredRealmId?, requiredRealmLevel?, combatTypeId?, element?, resourceLabel?, tierEffects?, combatModifiers?, unlocked, equipped` | `tierEffects`+`insight` → `getTechniqueTierModifiers` (PersistentEffectOps:171) via `getTechniqueTier(insight, insightMultiplier×1000)`; `combatModifiers` → `getTechniqueCombatModifiers` (no def declares any); `resourceLabel`/`element`/`combatTypeId` display-only; `requiredRealm*` gates nothing |
| `TechniqueManager` | learned **list** + `getEquipped()` | RewardOps insight grant, PersistentEffectOps, BattleLootSystem delta-read, TechniquePanel, TechniqueSlotCard, dead branch, test mocks |
| `TechniqueSystem` | `learn`/`equip`/`unequip` | `realmAdvanceOps.learnTechnique/equipTechnique`; learn-by-drop case |
| `TechniqueTier` | `BASE_TECHNIQUE_INSIGHT_REQUIRED=1000`, share thresholds 0/10/30/60%, `TECHNIQUE_TIER_LABELS` | PersistentEffectOps, useTechniqueSections, TechniqueSlotCard |
| Techniques data | **9 defs**: `tu_linh_quyet`, `dai_ngu_hanh_chan_quyet`, `dai_ngu_hanh_quyet_truc_co`, `ngo_dao_chan_quyet`, `ngu_kiem`, `van_kiem_quyet`, `kim_cang_bat_hoai_the`, `ung_the_than_quyet`, `thai_hu_kiem_quyet` (orphan) | way `techniqueId` refs; codex; restore templates |
| Realm-swap | `spell_pathway.realmRewards.foundation_establishment = { techniqueId, artifactId: 'ngu_hanh_chau' }` + composed passive | `grantCultivationPathRealmReward` — sole caller `TribulationOutcomeService:233`; `Math.max` insight carryover; duplicated in `BreakthroughOutcomeService` documented-dead branch (:111-117) |
| Insight economy | `EnemyReward.techniqueInsight` (~45 enemy entries), `Reward.techniqueInsight` (3 quests: 15/120/200), `RewardReceiver.addTechniqueInsight`, `StageDropTables currency.techniqueInsight` (5-8/35-45/90-120), `BattleRewardSummary.techniqueInsight`, `getSkillInsightReward` derives `skillInsight ?? round(techniqueInsight × 0.6)` | `gainEquippedTechniqueInsight` caps at `insightMultiplier×1000`, returns delivered delta |
| Reward settle timing | `processDefeatedEnemies` settles **per-kill during 'fighting'** — explicitly NOT victory-gated (BattleLootSystem:184 comment). Victory/defeat terminal in `GameManagerBattleRewardOps.grantTurnBattleRewards` (:119-165, `battleEndEmitted` once-guard) | kills in a losing battle already paid insight |
| Learn-by-drop | `DropKind 'technique'`; `grantResolvedDrops` case; `BattleRewardItemKind 'technique'` | **no authored entries** — only test fixtures |
| Boot grant | `learnTechnique+equipTechnique('tu_linh_quyet')` in `App.vue.onNewCharacter` + `EarlyGameBootstrap` | mortal gets `tu_linh_quyet` so_nhap stats (+15 might/def, +1/0.5 regen) |
| Persistence | `save.techniques: Technique[]`; restore drops unknown ids, re-derives `name/description/tierEffects/combatModifiers`; `validateIdEntries` checks `id` only | `SaveSystem.ts:335`, `GameManagerSaveRestore.ts:184-211` |
| UI | `TechniquePanel`, `TechniqueSlotCard` (insight→threshold bar + tier label), `useTechniqueSections`, `TechniqueCodex` (catalog browse) | `getEquipped` + `getTechniqueTierProgress` |

## 3. Scope

**In scope**

- New canonical `Technique` model: `grade`/`rank`/`mastery`/`quality` + `gradeEffects` (§4.1-4.3).
- `getTechniqueGradeCeiling(realmId)` on the canonical realm order (§4.4).
- `TechniqueSystem` as single progression writer: `grant`/`gainMastery`/`advanceTechniqueGrade`/`setTechniqueQuality` (D8 seam) (§4.5).
- **Victory-only mastery delivery** — pending accumulator flushed at the victory terminal (§4.6).
- `techniqueInsight` → `techniqueMastery` (enemy/drop surface) and → `skillInsight` (quest Reward channel) (§4.6).
- Six semantic-English canonical defs; `five_elements_art.gradeEffects[2]` folds `dai_ngu_hanh_quyet_truc_co` (§4.7).
- `grantCanonicalTechnique` at initiation; `TechniqueManager` → true 0-or-1 holder; save contract pinned (§4.8, §4.11).
- Retirements (§4.9): `tu_linh_quyet` + boot grants, `realmRewards.techniqueId` swap + carryover + dead branch, `TechniqueTier` insight arithmetic, learn-by-drop, learn/equip/unequip, `equipped`/`unlocked`/`insight`/`insightMultiplier`/`tierEffects`/`requiredRealm*`, `thai_hu_kiem_quyet`.
- UI minimal re-points + grade-transaction affordance on `TechniquePanel` (§4.10).
- Save v70 (§4.11).

**Out of scope** — `skillInsight` pool semantics (the 0.6 enemy-reward derivation is preserved); loadout (M4); TechniquePanel removal / Scripture Pavilion lore-only / SkillPathPanel IA (M7); node prerequisites (M6); new materials/techniques; effect-number tuning; breakthrough formula; mortal starter basics (M4); quality *mechanics* (D8 — op seam only, zero callers).

## 4. Design

### 4.1 Canonical model

```ts
export interface Technique {
  id: string
  name: string
  description: string
  icon?: string
  element?: ElementType            // display
  resourceLabel?: string           // display row
  combatTypeId?: string            // display
  combatModifiers?: StatModifier[] // equipped-effect channel (unused today, kept)

  // D1/D8 mutable progression state — persisted in save.techniques:
  grade: number                    // >= 1; <= getTechniqueGradeCeiling(realmId)
  rank: number                     // 0..TECHNIQUE_RANK_CAP
  mastery: number                  // progress toward next rank (per-rank bar)
  quality: ItemQuality             // D8 Chất axis; 'hoang' at grant

  gradeEffects?: Partial<Record<number, TechniqueRankBandEffects>>
}
export type TechniqueRankBandEffects = Partial<Record<TechniqueTier, TechniqueTierEffect>>
```

`TechniqueTier` (band vocabulary `so_nhap|tieu_thanh|dai_thanh|vien_man`) and `TechniqueTierEffect` **stay** — re-purposed as rank-band vocabulary. Removed fields: `insight`, `insightMultiplier`, `tierEffects`, `unlocked`, `equipped`, `requiredRealmId`, `requiredRealmLevel`.

### 4.2 Rank model — locked cost curve

```ts
export const TECHNIQUE_RANK_CAP = 10
export const BASE_RANK_MASTERY = 300
export function getTechniqueMasteryForNextRank(grade: number): number {
  return BASE_RANK_MASTERY * grade   // USER-LOCKED: 300 × grade
}
export function getTechniqueTierForRank(rank: number): TechniqueTier {
  if (rank >= 6) return 'vien_man'
  if (rank >= 3) return 'dai_thanh'
  if (rank >= 1) return 'tieu_thanh'
  return 'so_nhap'
}
```

- Grade-1 cadence is byte-identical to today: old `insightMultiplier:3` cap 3000, bands at 300/900/1800 → rank-ups at 300/900/1800 cumulative mastery (ranks 1/3/6).
- `mastery` is per-rank progress: `mastery >= cost → rank++, mastery -= cost` (overflow carries). At `rank === 10` accrual halts; the API reports `gained: 0`.
- `× grade` keeps the old `insightMultiplier` *purpose* (the retired `dai_ngu_hanh_quyet_truc_co` used `×4` — grade 2 at 600/rank is the same order). No per-technique multiplier field — nothing varies.

### 4.3 Effect resolution

```ts
// Highest authored grade table <= technique.grade; band from rank.
// A way with no authored grade-2 table keeps grade-1 numbers at grade 2.
export function getTechniqueEffects(technique: Technique): TechniqueTierEffect | undefined
```

`getTechniqueTierModifiers` (PersistentEffectOps) re-points to this resolution; emission shape (modifier ids, `sourceType:'technique'`, spell-domain gate) unchanged.

### 4.4 Grade ceiling (D9) — canonical realm order

```ts
// Ordered REALMS authority (realmSystem.getRealmIndex — REALMS array
// index): mortal 0, qi_refining 1, foundation_establishment 2, ...,
// body_integration 7, mahayana 8. Every realm advances the ceiling —
// NOT getRealmTier (an ECONOMY tier map that collapses
// body_integration onto mahayana's tier and maps unknown ids to 1).
export function getTechniqueGradeCeiling(realmId: string): number {
  return getRealmIndex(realmId)   // -1 on unknown id = "no technique possible" (fail-closed)
}
```

Invariant `technique.grade <= getTechniqueGradeCeiling(player.realmId)` enforced at grant and transaction; contract-tested. `getRealmTier` remains correct **only** for spirit-stone denomination (its economy job — §4.5 cost).

### 4.5 Progression API + grade transaction — single writer

`TechniqueSystem` owns ALL technique progression mutation (D7's dedicated API):

```ts
class TechniqueSystem {
  grant(template: Technique, realmId: string): boolean   // way initiation grant
  gainMastery(amount: number): { gained: number; rankUps: number }
  advanceTechniqueGrade(): boolean                       // writer; preconditions checked by orchestrator
  setTechniqueQuality(quality: ItemQuality): boolean     // D8 op seam — ZERO callers/UI/mechanics this phase
}
```

`grant` contract — slot + ceiling enforced; **the realm is an explicit parameter** (no hidden player dep): the caller passes the post-commit `player.realmId` and the system checks `template.grade <= getTechniqueGradeCeiling(realmId)`.
- Refuses if the slot already holds a different-id technique (same-id re-grant no-ops → `true` — defensive; the ritual preflight requires empty, §4.8).
- Refuses if `template.grade > getTechniqueGradeCeiling(realmId)` — `realmId: 'mortal'` (ceiling 0) fails closed for any grant attempted outside the ritual.
- On success initializes `{grade: template.grade (1), rank:0, mastery:0, quality: template.quality ('hoang')}`.

`gainMastery` contract — cap semantics pinned (single invariant: `mastery` always means "progress toward the NEXT rank", which is undefined at cap):
- `needed = cost(grade) × (TECHNIQUE_RANK_CAP - rank) - mastery` — total mastery still required to reach rank 10 (0 when already at cap).
- `consumed = min(amount, needed)`; `mastery += consumed`; while `mastery >= cost(grade)`: `rank++`, `mastery -= cost` (cascade). On the rank-10 crossing `mastery` lands at exactly 0 (consumed filled precisely `needed`).
- The unconsumed remainder `amount - consumed` is DISCARDED — not credited to `mastery`, not banked.
- `gained = consumed` (the portion actually spent into progression); `rankUps` = ranks crossed.
- **Rank-10 terminal state: `mastery === 0`** — no retained leftover, no drain of prior leftovers (there are none: the invariant makes cap mastery exactly 0). At cap `needed = 0` → `{gained: 0, rankUps: 0}`.

Pure helpers in the technique module (new `TechniqueProgression.ts` absorbing `TechniqueTier.ts`'s survivors — the insight functions all die):

```ts
export function canAdvanceTechniqueGrade(technique: Technique | undefined, realmId: string): boolean {
  return !!technique && technique.rank >= TECHNIQUE_RANK_CAP && technique.grade < getTechniqueGradeCeiling(realmId)
}
// USER-LOCKED cost rule: 200 stones for grade 1->2, expressed as the
// linear rule 100 x targetGrade (grade 2 -> 200; grade 3 -> 300) at the
// player's CURRENT realm-tier denomination. Extensible, not a constant.
export function getTechniqueGradeUpgradeCost(targetGrade: number, realmId: string): { materialId: string; amount: number } {
  return { materialId: getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId)), amount: 100 * targetGrade }
}
```

`realmAdvanceOps.tryAdvanceTechniqueGrade(player)` — orchestration seam (mirrors `tryUpgradeArtifactGrade`): combat guard (intro/countdown/fighting blocked) + `canAdvanceTechniqueGrade` + `materialBag.has/remove` of the cost → `techniqueSystem.advanceTechniqueGrade()` (`grade++`, `rank=0`, `mastery=0`). The mutation is the system's op, not an exported free function.

### 4.6 `techniqueMastery` channel + victory gate (D7)

**Field/channel renames:**

| From | To | Note |
|---|---|---|
| `EnemyReward.techniqueInsight` | `EnemyReward.techniqueMastery` | authored enemy currency (~45 entries) |
| `StageDropTable.currency.techniqueInsight` | `techniqueMastery` | 3 ranges |
| `resolveDrops` `drops.techniqueInsight` | `drops.techniqueMastery` | rolled per kill |
| `BattleRewardSummary.techniqueInsight` | `techniqueMastery` | shows DELIVERED amount (victory only) |
| `getSkillInsightReward` reads `.techniqueInsight` | reads `.techniqueMastery` | 0.6 derivation unchanged — enemies still grant per-kill skillInsight exactly as today |
| `Reward.techniqueInsight` | `Reward.skillInsight` | USER-LOCKED: the 3 quest grants convert (15/120/200 → skillInsight, same amounts) |
| `RewardReceiver.addTechniqueInsight` | `addSkillInsight` → `player.skillInsight` + `totalSkillInsightGained` | quest receiver path; spiritStone/cultivation unchanged |
| `GameManagerRewardOps.gainEquippedTechniqueInsight` | **removed** | receiver no longer routes technique currency; `techniqueManager` dep + TechniqueTier import dropped from RewardOps |

**Victory-only delivery (D7's literal flow):**

- `BattleLootSystem` gains `pendingTechniqueMastery` (reset in `beginBattle`). Per kill: `pending += floor(drops.techniqueMastery × realmRewardMultiplier)` — the per-kill settle timing is unchanged (rewards still settle mid-fight); only DELIVERY defers.
- `GameManagerBattleRewardOps.grantTurnBattleRewards` — inside the existing `battleEndEmitted` once-guard, `if (turnBattle.state === 'victory')` → `battleLoot.settleTechniqueMastery()`.
- **`settleTechniqueMastery` is consume-and-zero (pinned):** `amount = pending; pending = 0; gained = techniqueSystem.gainMastery(amount).gained; summary.techniqueMastery += gained` + one insight particle. Consumption is mandatory because the `repeat` cycle policy sets `preserveLootSession: true` — auto-repeat re-mints the engine but SKIPS `battleLoot.beginBattle()` (verified `GameManagerTurnBattleOps:1602`, `BattleCyclePolicy.repeat`) so the summary accumulates across cycles and an unconsumed pending would re-pay on the next cycle's victory flush. `beginBattle` still resets pending for non-repeat starts (belt on top of consumption).
- Defeat/abandon: pending is never settled — `beginBattle` discards it on the next fresh/stage start (or it dies with the session); defeat summary shows 0 mastery. Abandon path (`emitAbandonEnd`) does not flush.
- **Idle auto-farm channel** (`GameManagerAutoFarmOps.rollAutoFarmCycleReward`): runs no TurnBattle — every completed cycle is a *pre-proven victory* (farm eligibility requires a recorded perfect clear of that stage; there is no idle defeat). `rollAutoFarmCycleReward` calls `battleLoot.settleTechniqueMastery()` after `processDefeatedEnemies`, inside the existing try (before the channel-restore finally). Both entry points inherit this: `tickAutoFarm` (online) and `settleAutoFarmOffline` (offline catch-up calls `rollAutoFarmCycleReward` per completed cycle) — same per-cycle delivery as today's insight accrual.
- `BattleRewardItemKind 'technique'` and the per-kill `insightBeforeReward` delta-read die with the change.

### 4.7 Six canonical defs (D12) + way rewiring

| Way | Old id | New id | gradeEffects |
|---|---|---|---|
| `spell_pathway` | `dai_ngu_hanh_chan_quyet` (+`dai_ngu_hanh_quyet_truc_co` swap) | `five_elements_art` | `{1: chan_quyet table, 2: truc_co table}` |
| `hidden_spell_pathway` | `ngo_dao_chan_quyet` | `dao_insight_art` | `{1: ngo_dao table}` |
| `sword_pathway` | `ngu_kiem` | `sword_control_art` | `{1: ngu_kiem table}` |
| `hidden_sword_pathway` | `van_kiem_quyet` | `myriad_swords_art` | `{1: van_kiem table}` |
| `body_pathway` | `kim_cang_bat_hoai_the` | `diamond_body_art` | `{1: kim_cang table}` |
| `hidden_body_pathway` | `ung_the_than_quyet` | `responsive_body_art` | `{1: ung_the table}` |

- `name`/`description`/`icon`/`element`/`resourceLabel`/`combatTypeId` carried verbatim.
- Defs declare initial state defaults (`grade:1, rank:0, mastery:0, quality:'hoang'`).
- `spell_pathway.realmRewards.foundation_establishment` → `{ artifactId: 'ngu_hanh_chau' }` + composed passive (M2 mechanism unchanged).
- `TECHNIQUES` = exactly the 6 defs; `thai_hu_kiem_quyet`/`tu_linh_quyet`/`dai_ngu_hanh_quyet_truc_co` removed (`truc_co` folded, not lost).

### 4.8 Initiation grant + true 0-or-1 holder

- `chooseCultivationPath` atomicity: the preflight (before ANY commit) checks ALL of (a) the way's technique template resolves, (b) the technique slot is EMPTY — `techniqueManager.getActive() === undefined`. A mortal already holding ANY technique is corrupt under D9 (no mortal should ever hold one); the ritual rejects pre-commit rather than blessing the corruption — same-id-tolerant preflight is deliberately NOT used. (c) `getTechniqueGradeCeiling('qi_refining') >= template.grade` (defensive — constant-true today; keeps grant legal against any future ritual target). Any failure → path choice rejects pre-commit; zero partial mutation (path/way/realm/slice never written).
- **Commit ordering (pinned):** path/way/realm/slice writes commit FIRST (realm already `qi_refining`, ceiling 1) → then `grantCanonicalTechnique(way.techniqueId)` → `techniqueSystem.grant(template, player.realmId)` — the realm is passed explicitly and is already `qi_refining`. Grant can therefore never evaluate against `mortal` (ceiling 0) inside the ritual, and the same check fails closed for any grant attempted on a true mortal outside it.
- Grant initializes `{grade:1, rank:0, mastery:0, quality:'hoang'}`. `grant`'s own same-id re-grant no-op stays as defense-in-depth below the ritual's empty-slot contract; a different id while one is held returns false (unreachable post-preflight — ways are permanent).
- `TechniqueManager` → **single holder** (`active: Technique | null` internally): `getActive()` (replaces `getEquipped`), `get(id)`/`has(id)`/`getAll()` (≤1), `restore(entries)` accepts ≤1 (preflight guarantees). No `add` to a list — `grant` sets the slot.
- `TechniqueSystem.learn/equip/unequip` and `realmAdvanceOps.learnTechnique/equipTechnique/unequipTechnique` removed (boot grants and the dead branch were the last callers).
- Boot: `App.vue` + `EarlyGameBootstrap` drop the `tu_linh_quyet` lines — mortal has **no technique** (D9: absent). Mortal skill grants unchanged.

### 4.9 Realm-swap + learn-by-drop retirements

- `CultivationPathRealmReward.techniqueId` removed; `grantCultivationPathRealmReward` = artifact-only delivery (`reward.artifactId && !player.artifact → createDefaultArtifactProgress`), same return semantics (`true` = record exists; record contract becomes `artifactId|passiveSkillId`). `CultivationPathRewardDeps` (4 technique-only fields) and the `deps` parameter removed entirely — the artifact branch injects nothing.
- `BreakthroughOutcomeService` dead branch: the technique-swap block removed (artifact part unchanged); `BreakthroughConsequencesContext` drops `techniqueManager`/`learnTechnique`/`equipTechnique`.
- `DropKind` loses `'technique'`; `grantResolvedDrops` case + `BattleRewardItemKind 'technique'` removed; `BattleLootSystem` drops `techniqueManager`/`techniqueTemplates` deps (keeps `techniqueSystem` for the mastery API).

### 4.10 UI minimal re-points (full IA in M7)

- `TechniqueSlotCard`/`TechniquePanel`: `getActive()`; tier label = `TECHNIQUE_TIER_LABELS[getTechniqueTierForRank(rank)]`; bar = `mastery / getTechniqueMasteryForNextRank(grade)` (full at rank 10); adds `Cảnh {grade} · Cấp {rank}` + `ITEM_QUALITY_LABELS[quality]`.
- `useTechniqueSections`: effect lookup via `getTechniqueEffects`.
- `TechniquePanel`: "Đột Phá Tâm Pháp" button when `canAdvanceTechniqueGrade` — shows the spirit-stone cost, calls `tryAdvanceTechniqueGrade` (smallest reachable transaction surface; M7 redesigns it).
- `TechniqueCodex`: browses the 6 defs; owned = `manager.has` (M7 makes Scripture Pavilion lore-only).

### 4.11 Persistence + save contract

Save version **69 → 70** (phase mechanism — persisted-shape cut, reject old, no translator).

`save.techniques` is a hard 0-or-1 contract — **preflight validation** (before any owner mutation, in `preflightSaveRegistryReferences` style):

- Resolve the player's way from `save.player` via `getActiveWayDefinition` semantics.
- **Committed way** → `save.techniques.length === 1` AND `entry.id === way.techniqueId`. A wrong known canonical id (e.g. `sword_pathway` player holding `five_elements_art`) → **reject save** — fail-closed, not silently dropped. Unknown id → same reject (registry-drift principle: an owned entry is data, not noise).
- **No way** (mortal or corrupt pair) → `save.techniques.length === 0`; any entry → reject (a technique with no way to own it is corruption).
- Field validity: `Number.isInteger(grade) && 1 <= grade <= getTechniqueGradeCeiling(player.realmId)`; `Number.isInteger(rank) && 0 <= rank <= 10`; `Number.isInteger(mastery)` (accrual is `floor()`-produced) with rank-dependent bound — `rank < 10` → `0 <= mastery < getTechniqueMasteryForNextRank(grade)`; `rank === 10` → `mastery === 0` (the §4.5 terminal invariant); `quality` ∈ `ITEM_QUALITY_ORDER`.

Restore keeps template re-derivation (extends today's refresh to `element/resourceLabel/combatTypeId/gradeEffects`); `grade/rank/mastery/quality` persist per entry.

### 4.12 Honest-baseline deltas (not pure migration)

1. **Mortal loses `tu_linh_quyet` stats** (+15 might/defense +1/0.5 regen at so_nhap) — locked removal; real power delta, flagged.
2. **Spell grade-2 is earned, not instant** — old swap applied the stronger table at Trúc Cơ entry; D1 requires rank 10 + 200 stones + transaction. Foundation recipes fingerprint-shift.
3. **Defeat no longer pays mastery** — kills in a losing battle used to credit insight mid-fight; D7 gates delivery to terminal victory. Defeat summary shows 0.
4. **Mortal earns no mastery** — way-less player has no technique; the flush (victory terminal or auto-farm cycle) calls `gainMastery` which no-ops with no active technique (same "no target → lost" semantics, now universal for mortals — today `tu_linh_quyet` absorbed it).
5. **`thai_hu_kiem_quyet` fully retires**; `passive_thai_hu_kiem_y` remains authored-unused.

## 5. Guarantees

- One technique identity per way across all realms — swap channel gone (F4 closed).
- Mortal has no technique (D9) — no boot grant, fallback, or compat.
- Single progression writer — `TechniqueSystem` owns rank/grade/mastery/quality mutation; loot calls the API (D7); `advanceTechniqueGrade` is a system op, not a free function.
- Victory-only mastery (D7 literal) — pending accumulator; delivery only at a real victory terminal or a completed auto-farm cycle (eligibility = recorded perfect clear, i.e. a pre-proven victory); defeat/abandon discards.
- Realm-derived ceiling on the canonical realm order — every realm extends the ceiling (D9); unknown id fails closed.
- True 0-or-1 holder — save contract rejects wrong-id/multi-entry/no-way entries; `getActive` cannot silently pick among a list.
- Quality modeled + persisted with a dedicated (unused) mutation op seam (D8) — nothing else mutates it.
- Fail-closed — way-less/corrupt pair → no grant, no technique, no modifiers.
- Idempotent grant — same-id re-grant no-ops; different-id refuses; initiation preflight covers slot-acceptability so a failed grant can never strand a committed path (zero-mutation atomicity).

## 6. Test contract

- `gainMastery` accrues to cap; overflow cascades; mid-call rank-10 crossing consumes only `needed`, lands `mastery = 0` at cap, discards the tail; `gained` = consumed only; at cap `{gained:0, rankUps:0}`; repeated calls idempotent.
- `grant` refuses on a true mortal (ceiling 0); at the ritual it reads the post-commit `qi_refining` realm; preflight asserts ceiling >= template grade.
- Rank→band: rank 0/1/3/6/10 → `so_nhap/tieu_thanh/dai_thanh/vien_man/vien_man`.
- `getTechniqueGradeCeiling`: mortal→0, qi_refining→1, foundation→2, body_integration→7, mahayana→8 (proves no tier-collapse), unknown→-1.
- `tryAdvanceTechniqueGrade`: fails without rank 10 / at ceiling / in combat / without stones; success consumes `100×targetGrade` current-tier stones (grade 2 → 200) → `grade=2, rank=0, mastery=0`.
- `getTechniqueEffects` fallback: no authored grade-2 table → grade-1 table at grade 2.
- Initiation: grant yields `{id: way art, grade:1, rank:0, mastery:0, quality:'hoang'}`; mortal boot grants no technique (bootstrap + App path).
- Holder: `getActive` 0-or-1; save with 2 entries → reject; save with wrong canonical id → reject; way-less save with 1 entry → reject; valid way save accepted.
- Victory gate: kills + victory → mastery delivered once; kills + defeat → zero delivered, summary 0; flush consumes pending (auto-repeat `preserveLootSession` never re-pays a consumed amount — cycle N+1 victory pays only cycle N+1 kills).
- Idle channel: `rollAutoFarmCycleReward` delivers accumulated mastery per completed cycle (pre-proven-victory semantics); `tickAutoFarm` and `settleAutoFarmOffline` each deliver per cycle.
- Initiation atomicity: ritual rejects pre-commit (no path/way/realm/slice mutation) when the holder is non-empty — a mortal holding ANY technique is corrupt under D9, even a same-id one.
- Save: non-integer `rank`/`mastery`/`grade` → reject; `rank < 10 && mastery >= getTechniqueMasteryForNextRank(grade)` → reject; `rank === 10 && mastery !== 0` → reject.
- Way isolation: `grantCultivationPathRealmReward` delivers artifact only — spell foundation record returns true, grants `ngu_hanh_chau`, performs no swap/carryover.
- Pipeline: `getTechniqueTierModifiers` emits band effect at rank/grade; `getActive()` undefined → none.
- Channel: `getSkillInsightReward` derives from `techniqueMastery`; no `'technique'` DropKind; quest `skillInsight` grants credit `player.skillInsight` + `totalSkillInsightGained`.
- Save: v69 rejected; v70 accepted; restore re-derives authored fields, preserves state.
- Contract: every `realmRewards` record has `artifactId|passiveSkillId`; no `realmRewards.techniqueId`; TECHNIQUES = 6 D12 ids; `way.techniqueId` resolves.
- `setTechniqueQuality` seam: validates ItemQuality, writes the field, zero production callers (existence test only).
- Regression: initiation/tribulation/breakthrough/benchmark suites pass (fingerprint regen documented as §4.12-driven).

## 7. Dispositions

| System | Disposition | Rationale |
|---|---|---|
| `Technique` (`grade/rank/mastery/quality` + `gradeEffects`) | REPLACE | D1/D8/D9 canonical model |
| `TechniqueProgression` module (absorbs `TechniqueTier` vocabulary) | REPLACE | insight arithmetic dead; band labels survive |
| `getTechniqueGradeCeiling` via `getRealmIndex` | NEW | D9 canonical realm-order derivation |
| `TechniqueSystem` (`grant`/`gainMastery`/`advanceTechniqueGrade`/`setTechniqueQuality`) | REPLACE | single writer (D7 API + D8 seam) |
| `TechniqueManager` (single holder, `getActive`) | REPLACE | 0-or-1 contract, list semantics gone |
| `techniqueMastery` (enemy/drop/summary) | REPLACE (rename) | D7 semantic migration |
| `Reward.skillInsight` + `addSkillInsight` | REPLACE (of `techniqueInsight`/`addTechniqueInsight`) | quest channel converts (user-locked) |
| `pendingTechniqueMastery` + victory flush | NEW | D7 victory-only delivery |
| `way.techniqueId` + `grantCanonicalTechnique` | KEEP (re-pointed to grant) | way-owned initiation grant |
| Six `_art` defs | REPLACE (D12 re-author) | spine naming; content preserved |
| `realmRewards.techniqueId` + swap + carryover | RETIRE | F4: same-art grade replaces variant |
| `BreakthroughOutcomeService` technique dead-branch | RETIRE | swap dead |
| `tu_linh_quyet` + boot grants | RETIRE | locked removal |
| `dai_ngu_hanh_quyet_truc_co` | FOLD → `five_elements_art.gradeEffects[2]` | content preserved as grade |
| `thai_hu_kiem_quyet` | RETIRE | orphan + last reachability dead |
| Learn-by-drop (`DropKind 'technique'`, loot case, summary kind) | RETIRE | no technique library |
| `equipped`/`unlocked`/`insight`/`insightMultiplier`/`tierEffects`/`requiredRealm*` | RETIRE | replaced fields |
| `TechniqueCodex` | KEEP (interim) | browses 6 defs; M7 lore-only |
| `getSkillInsightReward` 0.6 derivation | KEEP (re-pointed) | separate pool, unchanged math |
| `quality: ItemQuality` + `setTechniqueQuality` | NEW (D8) | axis + deferred op seam |

## 8. Non-goals

Loadout retirement (M4); BodyProgression chapters (M5); node prerequisites (M6); TechniquePanel removal / Scripture Pavilion lore-only / SkillPathPanel IA (M7); save translators; new techniques/materials; effect-number tuning; quality mechanics; breakthrough formulas; mortal starter basics (M4).

# Companion Gacha (Chiêu Mộ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the full companion recruitment loop — Chiêu Hiền Lệnh token sources, pity-aware gacha pull, Duyên Phận exchange, Cung Mệnh duplicate progression, realm-capped companion leveling, combat skill-kit unlocks, and the two UI surfaces (Chiêu Mộ tab + standalone Companion panel) — on top of the existing companion/formation primitives.

**Architecture:** Pure mechanisms live in `core/companion/` (progression + gacha), orchestration in `GameManagerCompanionOps` (DI pattern matching `GameManagerQuestOps`), content in `data/companion/Companions.ts`, UI in `WorkerLodgePanel.vue` tabs + new `CompanionPanel.vue` standalone overlay. One rule one owner: stats/leveling/kit-resolution are pure functions; the ops class owns currency/state mutation; presentation only renders `PullResult`.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Vitest, existing `TurnSkillDefinition`/`TurnBattleParticipant` machinery, `MaterialBag`, `resolveDrops`/`SignatureDrop`, `saveShapeValidation`.

**Spec:** `docs/superpowers/specs/2026-09-12-companion-gacha-design.md` — read it alongside this plan; all rates/thresholds/decisions below are argued there.

## Global Constraints

- Rate table (verbatim from spec): `hoang 0.8399 / huyen 0.10 / dia 0.05 / thien 0.01 / tien 0.0001`, filtered to grades with ≥1 definition then renormalized — `pickDefinitionOfGrade` throws on an empty grade pool, so filtering is load-bearing, not optional.
- `PITY_THRESHOLD = 30`; elevated rates = relative weights `{ dia: 5, thien: 1, tien: 0.01 }` (same empty-grade filtering); pity increment order: `counter += 1 → pity check → roll → reset if grade >= 'dia'`.
- Exchange costs `EXCHANGE_COST = { hoang: 20, huyen: 30, dia: 60, thien: 150, tien: 300 }`; `DUPLICATE_MAXED_DUYEN_PHAN = 5`; `MAX_CONSTELLATION_RANK = 6`; `CONSTELLATION_STAT_PER_RANK = 0.10`.
- Pull token: material id `chieu_hien_lenh`, `category: 'other'`, **no** `profession` meta, 1 token = 1 pull.
- Invariant: exactly one `CompanionInstance` per `definitionId` in `player.companions` (array shape kept for MVP — all consumers read arrays).
- Companion realm cap = `player.realmId` (dynamic — follows player breakthroughs); grade never gates realm.
- Two distinct "max" reasons: `level_maxed` (at player realm + max tier — blocks feed only) vs `constellation_maxed` (rank 6 — blocks exchange; pull converts to +5 DP).
- Save: bump `CURRENT_SAVE_VERSION` to `60`, **no migration** — dev-phase convention rejects prior versions (see `saveVersion.ts` comments).
- `combatantId` in formation stays `definitionId` (unique by the 1-1 invariant) — do NOT switch formation keys to `instanceId`.
- Core files under `core/` stay Vue/Phaser/Pinia-free (A6); comments in English ASCII (P15); UI strings via i18n keys (P16); verify with `npm run type-check` + `npx vitest run <scope>` per task, full `npm run build` + `npx vitest run` at the end.

---

## File Map

### Create

| File | Responsibility |
|---|---|
| `src/core/companion/CompanionProgression.ts` | EXP curve, realm-capped `applyCompanionExp`, `companionStatsAt`, `resolveCompanionSkillKit`, `isCompanionSkillUnlocked`, feed-exp value — all pure |
| `src/core/companion/CompanionProgression.test.ts` | Unit tests |
| `src/core/game/GameManagerCompanionOps.ts` | `pullCompanion` / `exchangeCompanion` / `feedCompanion` orchestration + result types |
| `src/core/game/GameManagerCompanionOps.test.ts` | Ops integration tests |
| `src/components/panels/CompanionPanel.vue` | Standalone roster/detail/feed panel |
| `src/components/panels/worker-lodge/ChieuMoTab.vue` | Pull UI inside Chiêu Hiền Quán |
| `src/components/panels/worker-lodge/DuyenPhanTab.vue` | Exchange UI inside Chiêu Hiền Quán |

### Modify

| File | Change |
|---|---|
| `src/data/companion/Companions.ts` | Extend `CompanionDefinition`/`CompanionInstance`, add `ConstellationPerk`/`CompanionSkillOverride` types, MVP roster, remove `TEST_COMPANIONS` |
| `src/core/companion/CompanionGacha.ts` | Pity-aware `pullCompanion`, effective-rate filtering, `createCompanionInstance` factory |
| `src/core/companion/CompanionGacha.test.ts` | Update for new semantics |
| `src/core/player/Player.ts` | `companionPullsSinceRare`, `duyenPhan` + `createDefaultPlayer` defaults |
| `src/core/game/GameManager.ts` | Wire `companionOps`, facade methods |
| `src/services/save/saveVersion.ts` | `CURRENT_SAVE_VERSION = 60` + comment |
| `src/services/save/saveShapeValidation.ts` | Validate new companion/player fields |
| `src/data/materials/materials.ts` | `chieu_hien_lenh` entry |
| `src/data/enemy/Enemies.ts` | `signatureDrops` token entries on the 3 floor-10 boss species |
| `src/data/quest/quests.ts` | One daily quest rewarding a token |
| `src/core/game/BattleLootSystem.ts` | Companion battle-EXP hook in `processDefeatedEnemies` |
| `src/core/companion/CompanionCombat.ts` | `companionToCombatEntity` uses `companionStatsAt` |
| `src/core/game/GameManagerTurnBattleOps.ts` | Companion participants get `resolveCompanionSkillKit` kit (~line 847) |
| `src/components/panels/WorkerLodgePanel.vue` | TabBar with `nhan_cong` / `chieu_mo` / `duyen_phan` |
| `src/presentation/contracts/panelIds.ts` | `StandalonePanel += 'companion'` |
| `src/data/ui/commandWheelCatalog.ts` | New wheel entry → standalone `companion` |
| `src/components/layout/GameRoot.vue` | Mount `<CompanionPanel />` beside `<TranPhapPanel />` |
| `src/locales/vi.json`, `src/locales/en.json` | `companion.*` + `workerLodge.chieuMo.*`/`duyenPhan.*` keys |
| `src/components/panels/TranPhapPanel.vue` | Remove test-companion grant button |
| `docs/systems/companions.md` | Update to reflect shipped system |

### Delete

| File | Reason |
|---|---|
| `src/core/companion/CompanionLeveling.ts` | Superseded by `CompanionProgression` (flat 100-exp curve, no realm awareness) |
| `src/core/companion/CompanionLeveling.test.ts` | With it |

---

## Task 1 — Data model: schema + player fields

Extend the owned/persisted shapes first so every later task compiles against them.

**Files:** `src/data/companion/Companions.ts`, `src/core/player/Player.ts`, `src/core/companion/CompanionGacha.ts` (compile fix only — `pullCompanion` constructs instances), `src/core/companion/CompanionLeveling.ts` (compile fix), `src/components/panels/TranPhapPanel.vue` (compile fix for grant payload), existing `*.test.ts` that construct `CompanionInstance` literals.

- [x] In `Companions.ts`, add types and extend interfaces:

```ts
export type CompanionSkillSlot = 'basic' | 'special' | 'ultimate'

/** Whitelisted skill overrides — id/targeting may NOT be overridden (A8). */
export interface CompanionSkillOverride {
  cooldownTurns?: number
  damageMultiplierPercent?: number   // multiplies damage.multiplier, e.g. 20 = ×1.2
  healPercentOfDamage?: number
}

export type ConstellationPerk =
  | { atRank: number; kind: 'stat'; stat: keyof CompanionBaseStats; percent?: number; flat?: number }
  | { atRank: number; kind: 'skill_override'; slot: CompanionSkillSlot; overrides: CompanionSkillOverride }

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  growthRate: number                       // stat multiplier per global cultivation level
  unlockThresholds: {                      // realm gate per slot (compare vs instance realm/tier)
    special?: { realmId: string; realmLevel: number }
    ultimate?: { realmId: string; realmLevel: number }
  }
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
  constellationPerks?: ConstellationPerk[]
}

export interface CompanionInstance {
  instanceId: string          // stable identity — crypto.randomUUID(), never array index
  definitionId: string
  realmId: string             // starts 'mortal'
  realmLevel: number          // tier within realmId (1..realm.maxLevel)
  exp: number                 // exp banked within current tier
  constellationRank: number   // 0..6
}
```

- [x] Update `TEST_COMPANIONS` literals with `growthRate: 0.05`, `unlockThresholds: {}` so the file compiles (removed in Task 11).
- [x] In `Player.ts`: add `companionPullsSinceRare: number` and `duyenPhan: number` to `PlayerData`; in `createDefaultPlayer()` initialize both `0`.
- [x] Compile-fix `CompanionGacha.pullCompanion` temporarily: new-instance branch returns `{ instanceId: newInstanceId(), definitionId: definition.id, realmId: 'mortal', realmLevel: 1, exp: 0, constellationRank: 0 }` where `newInstanceId` is an injected `() => string` param defaulting to `crypto.randomUUID`; keep duplicate→exp for now (Task 3 rewrites semantics).
- [x] Compile-fix `CompanionLeveling.grantCompanionExp` signature only (keep `exp`, drop `level` write — `level` field no longer exists on instance; the function becomes `{ ...instance, exp: instance.exp + amount }` and is deleted wholesale in Task 2).
- [x] Compile-fix every literal `CompanionInstance` construction in tests/`TranPhapPanel.vue` (add the 3 new fields; `instanceId` can be any string literal in tests).
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/companion src/core/player` — green before moving on.

---

## Task 2 — `CompanionProgression.ts`: EXP curve, realm cap, stats, skill kit

New pure module replaces `CompanionLeveling`. All functions are pure — they return new instances, never mutate.

**Files:** create `src/core/companion/CompanionProgression.ts` + test; delete `src/core/companion/CompanionLeveling.ts` + `CompanionLeveling.test.ts`; migrate `CompanionGacha.ts`'s import (Task 3 owns the semantic rewrite — for now point its call at `applyCompanionExp`).

- [x] Implement:

```ts
// src/core/companion/CompanionProgression.ts
import type { CompanionDefinition, CompanionInstance, CompanionBaseStats, CompanionSkillSlot } from '@/data/companion/Companions'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'
import { REALMS } from '@/data/realms/realm'
import { getRealmIndex, getGlobalCultivationLevel } from '@/core/realm/realmSystem'
import type { Material } from '@/core/material/Material'

export const MAX_CONSTELLATION_RANK = 6
export const CONSTELLATION_STAT_PER_RANK = 0.10
const EXP_BASE = 40
const EXP_TIER_EXPONENT = 1.2
const BATTLE_EXP_PER_KILL_BASE = 2

// (index+1) makes mortal cost 1x — getRealmIndex('mortal') is 0 and a 0
// multiplier would make every tier free.
export function companionExpRequiredForLevel(realmId: string, realmLevel: number): number {
  return Math.round(EXP_BASE * Math.pow(realmLevel, EXP_TIER_EXPONENT) * (getRealmIndex(realmId) + 1))
}

export function companionBattleExpPerKill(stageRealmId: string): number {
  return BATTLE_EXP_PER_KILL_BASE * (getRealmIndex(stageRealmId) + 1)
}

export function companionGlobalLevel(instance: Pick<CompanionInstance, 'realmId' | 'realmLevel'>): number {
  return getGlobalCultivationLevel(instance.realmId, instance.realmLevel)
}

export interface ApplyExpResult {
  instance: CompanionInstance
  levelsGained: number
  realmBreakthroughs: string[]   // realmIds entered, in order (can chain)
  clampedExp: number           // exp discarded at the player-realm ceiling
}
```

- [x] `applyCompanionExp(instance, amount, playerRealmId): ApplyExpResult` — loop: while `exp >= required` → `exp -= required; realmLevel++`; when `realmLevel > realm.maxLevel` and `getRealmIndex(realmId) < getRealmIndex(playerRealmId)` → advance `realmId` to `REALMS[index+1].id`, `realmLevel = 1`, push to `realmBreakthroughs`; when at player realm AND `realmLevel === maxLevel` → discard remaining exp into `clampedExp`, set `exp = 0`, stop. Guard `amount <= 0` / non-finite → return unchanged instance.
- [x] `isCompanionLevelMaxed(instance, playerRealmId): boolean` — `getRealmIndex(instance.realmId) === getRealmIndex(playerRealmId) && instance.realmLevel === realm.maxLevel`.
- [x] `companionStatsAt(definition, instance): CompanionBaseStats`:

```ts
const globalLevel = companionGlobalLevel(instance)
const growth = 1 + definition.growthRate * (globalLevel - 1)
const constellation = 1 + CONSTELLATION_STAT_PER_RANK * instance.constellationRank
// 'stat' perks at atRank <= constellationRank apply on top (flat then percent)
```

Speed does not scale with level but DOES take `stat` perks/`flat` bonuses if authored. Round `maxHp`/`attack`.
- [x] `isCompanionSkillUnlocked(definition, instance, slot): boolean` — `basic` always true; `special`/`ultimate` require the definition to declare the skill AND `unlockThresholds[slot]`, then compare `(instance realmIndex, realmLevel) >= (threshold realmIndex, realmLevel)` — use `getRealmIndex` for realm comparison, never string equality alone.
- [x] `resolveCompanionSkillKit(definition, instance): { basic: TurnSkillDefinition; special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }` — start from unlocked slots, then apply every `skill_override` perk with `atRank <= constellationRank` matching that slot: `cooldownTurns` overrides, `damageMultiplierPercent` multiplies `damage.multiplier` when the skill has `damage`, `healPercentOfDamage` sets the field. Never mutate the definition's skill objects — clone `{...skill, damage: {...skill.damage, multiplier: …}}`.
- [x] `companionFeedExpValue(material: Material): number` — `10 × (getRealmIndex(material.profession.realmId) + 1)` when `material.profession` is present (`ProfessionMaterialMeta.realmId` — `core/profession/ProfessionMaterial.ts:40`), else flat `10`.
- [x] Delete `CompanionLeveling.ts` + its test; point `CompanionGacha`'s remaining exp call at `applyCompanionExp` (signature `(instance, amount, playerRealmId)` — pull path won't call it after Task 3, so a temporary compile shim is acceptable; if awkward, leave the import removal to Task 3 entirely).
- [x] **Tests** (`CompanionProgression.test.ts`):
  - `companionExpRequiredForLevel('mortal', 1) === 40`, scales with tier and realm index (qi_refining ≈ 2× mortal same tier).
  - `applyCompanionExp` levels up once with leftover carry; chains a realm breakthrough (`mortal` maxLevel → `qi_refining` 1, exp carried, `realmBreakthroughs` records entry).
  - At player realm + maxLevel → `clampedExp` equals the discarded remainder, `exp === 0`, `isCompanionLevelMaxed` true.
  - `companionStatsAt`: `growthRate 0.05` at globalLevel 21 → `×(1 + 0.05×20) = ×2`; constellationRank 3 → extra `×1.3`; a `stat` perk `flat`/`percent` applies only when `atRank <= rank`.
  - Golden-core boundary: global level math uses real `maxLevel` (mortal 18 → golden_core 9), i.e. `companionGlobalLevel({realmId:'golden_core', realmLevel:1}) === 55` — guards the old `index × 18` bug.
  - `resolveCompanionSkillKit`: locked special absent; unlocked special present; `skill_override` reduces `cooldownTurns` and multiplies damage without mutating the definition object (assert source unchanged).
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/companion`.

---

## Task 3 — `CompanionGacha.ts` rework: effective rates, pity, Cung Mệnh

**Files:** `src/core/companion/CompanionGacha.ts` + test.

- [x] Replace module contents:

```ts
export const COMPANION_BASE_RATES: Record<ItemGrade, number> = {
  hoang: 0.8399, huyen: 0.10, dia: 0.05, thien: 0.01, tien: 0.0001,
}
export const PITY_THRESHOLD = 30
// Relative weights — renormalized internally; also filtered to grades
// that exist in the pool.
export const PITY_ELEVATED_WEIGHTS: Partial<Record<ItemGrade, number>> = { dia: 5, thien: 1, tien: 0.01 }
export const DUPLICATE_MAXED_DUYEN_PHAN = 5
```

- [x] `effectiveCompanionRates(rates, pool): Record<ItemGrade, number>` — zero-out grades with no definition in `pool`, renormalize the rest to sum 1. `rollCompanionGrade` keeps its cumulative-scan body (a 0-rate grade can never trigger `roll < cumulative`); `pickDefinitionOfGrade` unchanged (throw stays as the unreachable-by-construction guard).
- [x] `createCompanionInstance(definition, newInstanceId = crypto.randomUUID): CompanionInstance` — `{ instanceId: newInstanceId(), definitionId: definition.id, realmId: 'mortal', realmLevel: 1, exp: 0, constellationRank: 0 }`.
- [x] Rewrite `pullCompanion` — pure, returns everything the ops layer needs:

```ts
export interface CompanionPullOutcome {
  definition: CompanionDefinition
  grade: ItemGrade
  isDuplicate: boolean
  pityTriggered: boolean
  kind: 'new' | 'constellation_up' | 'constellation_maxed'
  constellationRankAfter?: number
  duyenPhanBonus: number   // 0 normally, DUPLICATE_MAXED_DUYEN_PHAN when maxed
}

export function pullCompanion(
  owned: CompanionInstance[],
  pool: readonly CompanionDefinition[],
  pullsSinceRare: number,
  random: () => number = Math.random,
  newInstanceId: () => string = crypto.randomUUID,
): { owned: CompanionInstance[]; pullsSinceRare: number; outcome: CompanionPullOutcome }
```

Order exactly per spec §2: `counter = pullsSinceRare + 1` → `pityTriggered = counter >= PITY_THRESHOLD` → `grade = rollCompanionGrade(effectiveCompanionRates(pityTriggered ? expandedWeights : COMPANION_BASE_RATES, pool), random)` — for pity, build `Record<ItemGrade, number>` by spreading `PITY_ELEVATED_WEIGHTS` into a zeroed record (hoang/huyen get 0 — the pity floor IS dia) then filter by pool → `pickDefinitionOfGrade` → `pullsSinceRare = grade >= 'dia' ? 0 : counter` → duplicate branch: `constellationRank < 6` → new array with rank+1 (`kind:'constellation_up'`); `=== 6` → unchanged array, `kind:'constellation_maxed'`, `duyenPhanBonus: 5` → new branch appends `createCompanionInstance`.
- [x] Remove `DUPLICATE_PULL_EXP` and the `grantCompanionExp` import entirely.
- [x] **Tests** (`CompanionGacha.test.ts`):
  - Effective rates: pool with zero `tien` definitions → normalized table has `tien: 0`, pull never throws, hoang renormalized to `0.8399 / (1 - 0.0001)`.
  - Pity ordering: `pullsSinceRare = 29`, random forced to natural `dia` → counter returns 0, `pityTriggered: false` (pity never armed — the increment-then-check order makes pull 30 the last natural roll… verify: counter becomes 30 → `pityTriggered` TRUE for that pull; correct spec semantics is "pull 30 uses elevated rates". Keep the implementation literal: `counter >= 30` arms pity ON pull 30. Natural-dia-on-29 → reset → next pull counts from 1).
  - Pull 30 after 29 non-dia → grade ∈ {dia, thien, tien} only, `pityTriggered: true`, counter resets to 0.
  - Duplicate `hoang` → `kind:'constellation_up'`, rank 0→1, array length unchanged, same `instanceId` preserved.
  - Duplicate at rank 6 → `kind:'constellation_maxed'`, `duyenPhanBonus === 5`, instance untouched.
  - New pull → instance has `realmId 'mortal'`, `realmLevel 1`, `constellationRank 0`, non-empty `instanceId`.
  - 1-1 invariant: pulling the same definition thrice keeps `owned.length === 1`.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/companion`.

---

## Task 4 — `GameManagerCompanionOps` + GameManager wiring

**Files:** create `src/core/game/GameManagerCompanionOps.ts` + test; modify `src/core/game/GameManager.ts`, `src/core/player/Player.ts` was already done.

- [x] Mirror `GameManagerQuestOps` DI shape — constructor takes a deps object; active player via a `getActivePlayer: () => PlayerData | null` closure (copy exactly how `GameManagerQuestOps` receives it).
- [x] Public API + result unions:

```ts
export type PullCompanionResult =
  | { ok: true; outcome: CompanionPullOutcome; duyenPhan: number; pullsSinceRare: number }
  | { ok: false; reason: 'missing_token' | 'no_active_player' }

export type ExchangeCompanionResult =
  | { ok: true; definition: CompanionDefinition; kind: 'new' | 'constellation_up'; constellationRankAfter?: number; duyenPhan: number }
  | { ok: false; reason: 'unknown_definition' | 'constellation_maxed' | 'insufficient_duyen_phan' | 'no_active_player' }

export type FeedCompanionResult =
  | { ok: true; expGained: number; levelsGained: number; realmBreakthroughs: string[]; clampedExp: number }
  | { ok: false; reason: 'unknown_instance' | 'unknown_material' | 'level_maxed' | 'insufficient_material' | 'no_active_player' }
```

- [x] `pullCompanion()`: player → `materialBag.has('chieu_hien_lenh', 1)` else `missing_token` → `materialBag.remove(...)` → `pullCompanion(player.companions, COMPANIONS, player.companionPullsSinceRare)` → write back `player.companions`, `player.companionPullsSinceRare`, `player.duyenPhan += 1 + outcome.duyenPhanBonus` → return result. (Roll can't fail post-filtering; if `pickDefinitionOfGrade` ever threw, refund the token inside a try/catch and rethrow — one line, belt-and-suspenders for the atomic convention.)
- [x] `exchangeCompanion(definitionId)`: lookup in `COMPANIONS` → owned check → `constellationRank === 6` → reject before touching points → `player.duyenPhan >= EXCHANGE_COST[definition.grade]` else reject → deduct → new: `player.companions.push(createCompanionInstance(definition))`; owned: rank+1 (mutate the located instance's field — PlayerData is a mutable struct; do NOT clone-push a second instance).
- [x] `feedCompanion(instanceId, materialId, count)`: find instance by `instanceId` (not index) → `isCompanionLevelMaxed` → `level_maxed` reject **before** `materialBag.remove` → material lookup + `bag.has(materialId, count)` → remove → `applyCompanionExp(instance, expValue × count, player.realmId)` → write instance back into the array → return gains.
- [x] `GameManager.ts`: add `private readonly companionOps` constructed beside `questOps` (same deps shape it needs — bag/player closures; read how `questOps` is instantiated at ~line 584 and copy), plus facade methods `pullCompanion()`, `exchangeCompanion(definitionId)`, `feedCompanion(instanceId, materialId, count)` delegating to ops.
- [x] **Tests** (`GameManagerCompanionOps.test.ts` — follow `GameManagerQuestOps` test setup for building a GameManager/player):
  - `pullCompanion` with 0 tokens → `missing_token`, `duyenPhan`/`companions` unchanged.
  - With token → token count −1, `duyenPhan +1`, `pullsSinceRare` updated, instance appended on new.
  - Duplicate → rank+1 and `duyenPhan +1`; maxed duplicate → `+6` total DP (1 base + 5 bonus).
  - `exchangeCompanion` insufficient → nothing deducted; owned rank<6 → rank+1, DP deducted; owned rank 6 → `constellation_maxed`, DP intact; unowned → new instance pushed.
  - `feedCompanion` on level-maxed instance → `level_maxed`, material NOT removed (assert bag amount unchanged — the early-reject ordering is the point).
  - `feedCompanion` valid → exp/levels applied, material decremented.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/game/GameManagerCompanionOps`.

---

## Task 5 — Save v60 + validation

**Files:** `src/services/save/saveVersion.ts`, `src/services/save/saveShapeValidation.ts`, validator test file (find existing save-validation tests — extend in place).

- [x] `saveVersion.ts`: `CURRENT_SAVE_VERSION = 60` + one-line comment `v60: companion gacha (instanceId/realmId/constellationRank, pity counter, duyenPhan)`. No migration — older saves rejected per dev-phase convention.
- [x] `saveShapeValidation.ts`: in the player-shape check add — `companionPullsSinceRare`/`duyenPhan` finite numbers ≥ 0; every `companions[]` entry: `instanceId` non-empty string, `definitionId` string, `realmId` resolves in `REALMS`, `realmLevel` integer ≥ 1 (cap to realm maxLevel optional — clamp is friendlier for dev saves; reject is stricter. **Choose reject** — malformed data should fail loud, matching existing validator strictness), `exp` finite ≥ 0, `constellationRank` integer 0..6.
- [x] **Tests:** valid v60-shaped player passes; NaN `duyenPhan` rejected; `constellationRank: 7` rejected; missing `instanceId` rejected; bad `realmId` rejected.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/services/save`.

---

## Task 6 — Chiêu Hiền Lệnh: material, boss drops, daily quest

**Files:** `src/data/materials/materials.ts`, `src/data/enemy/Enemies.ts`, `src/data/quest/quests.ts`.

- [x] Material entry (match existing `category:'other'` shape — `id/name/category/sourceType/description/stackLimit`):

```ts
{
  id: 'chieu_hien_lenh',
  name: 'Chiêu Hiền Lệnh',
  category: 'other',
  sourceType: 'boss',
  description: 'Lệnh bài khắc phù văn chiêu mộ — dùng tại Chiêu Hiền Quán để chiêu mộ đồng đội.',
  stackLimit: 999,
},
```

- [x] `signatureDrops` additions (`requiresModifier: 'boss'` — same pattern as `yeu_dan_hung_giao` at Enemies.ts:669): `mortal_ferocious_giant_crocodile` (ch1 f10 boss) → `amount {min:1,max:1}, chance:1`; `ferocious_flood_serpent` (ch2 f10 boss) → `{min:2,max:2}`; `foundation_ferocious_flood_dragon_whelp` (ch3 f10 boss) → `{min:3,max:3}`.
- [x] One daily quest in `quests.ts` (daily pool, kill-generic so it's always completable — match existing daily style):

```ts
{
  id: 'daily_chieu_hien_lenh',
  name: '[Hàng Ngày] Chiêu Hiền Chi Lễ',
  description: 'Đánh bại 20 địch nhân bất kỳ để nhận 1 Chiêu Hiền Lệnh.',
  condition: { kind: 'kill', amount: 20 },   // enemyId omitted = any enemy (KillQuestCondition.enemyId?)
  reward: { itemDrops: [{ kind: 'material', itemId: 'chieu_hien_lenh', amount: 1 }] },
  cadence: 'daily',
},
```

- [x] **Tests:** material resolves in registry; `resolveDrops` on each boss with `requiresModifier:'boss'` context yields the token (extend an existing boss-drop test pattern — see `HiddenBeastDrops.test.ts`); daily quest claims `itemDrops` into `materialBag` via the normal claim path.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/data`.

---

## Task 7 — Battle EXP hook in `BattleLootSystem`

**Files:** `src/core/game/BattleLootSystem.ts`, extend a loot test file.

- [x] Inside `processDefeatedEnemies`, in the per-kill block where `this.player` and `stage` are both in scope (after `resolveDrops`, beside the reward-grant section): resolve `resolvePartyFormation(this.player)` → for each slot `combatantId !== 'player'`, find the companion instance by `definitionId` → `applyCompanionExp(instance, companionBattleExpPerKill(stage?.requiredRealmId ?? enemy.realmId), this.player.realmId)` → replace the instance in `player.companions` (array of mutable struct entries — write via index).
- [x] Snapshot semantics: formation read **per kill** — a mid-battle formation change affects the next kill, exactly per spec §7.
- [x] Auto-farm: the idle shim already calls `processDefeatedEnemies` (see `GameManagerTurnBattleOps.idleDrops.test.ts`) → companions gain EXP on autofarm automatically. Assert this in test rather than adding a second path (A9).
- [x] Skip when `!this.player` or instance is level-maxed (`applyCompanionExp` already clamps — rely on it, don't pre-check).
- [x] **Tests:** assigned companion gains `companionBattleExpPerKill` per kill; unassigned companion gains 0; kill with no stage context falls back to `enemy.realmId`; level-maxed companion stays clamped; autofarm-shim invocation grants EXP.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/game/BattleLootSystem src/core/game/GameManagerTurnBattleOps.idleDrops`.

---

## Task 8 — Combat integration: stats + resolved skill kit

**Files:** `src/core/companion/CompanionCombat.ts`, `src/core/game/GameManagerTurnBattleOps.ts` (~line 847), `src/core/game/TurnBattleAdapter.test.ts` or a new companion-participant test.

- [x] `companionToCombatEntity`: replace `companionStatsAtLevel(definition.baseStats, instance.level)` with `companionStatsAt(definition, instance)`; `realmIndex: getRealmIndex(instance.realmId)` (was hardcoded 0). Delete `companionStatsAtLevel`/`PER_LEVEL_GROWTH`.
- [x] `GameManagerTurnBattleOps`: in the companion `flatMap` (line ~833-848), replace `toTurnBattleParticipant(entity, index + 100, definition.basic)` with:

```ts
const kit = resolveCompanionSkillKit(definition, instance)
return [toTurnBattleParticipant(entity, index + 100, kit.basic, undefined, { special: kit.special, ultimate: kit.ultimate })]
```

- [x] **Tests:** companion below special threshold → participant has `basic` only; at threshold → `special.skill` present; `skill_override` perk at C2 → resolved cooldown reflected in participant's `special.skill.cooldownTurns`; stats in entity include constellation multiplier.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/core/companion src/core/game/TurnBattleAdapter src/core/game/GameManagerTurnBattleOps`.

---

## Task 9 — Chiêu Hiền Quán tabs: Chiêu Mộ + Đổi Duyên Phận

**Files:** `src/components/panels/WorkerLodgePanel.vue`, create `src/components/panels/worker-lodge/ChieuMoTab.vue` + `DuyenPhanTab.vue`, `src/locales/{vi,en}.json`.

- [x] `WorkerLodgePanel.vue`: add `TabBar` (pattern = `EquipmentHallPanel.vue` lines 46-97 — `activeTab` ref + `:model-value` + per-tab render). Tabs: `nhan_cong` (existing body), `chieu_mo`, `duyen_phan`.
- [x] `ChieuMoTab.vue` (`<script setup lang="ts">`, Composition API, `useI18n({ useScope: 'local' })` or shared ns — match neighbouring panels): token count from material bag, pity `x/30` from `player.companionPullsSinceRare`, DP count, Pull button (`:disabled` when token 0 or pull in-flight), reveal card bound to last `PullCompanionResult` — name, grade color class, `Trùng → Cung Mệnh +1 (C{n})` / `+5 Duyên Phận` strings via i18n with params. UI renders the returned result — never re-rolls or re-derives (A7).
- [x] `DuyenPhanTab.vue`: list `COMPANIONS` grouped by grade — name, cost, owned + `C{n}` badge, button states: `insufficient_duyen_phan`/`constellation_maxed` disabled with reason tooltip; calls `gameManager.exchangeCompanion`.
- [x] i18n keys under `workerLodge.tabs.*`, `chieuMo.*`, `duyenPhan.*` in both `vi.json` and `en.json`.
- [x] **Tests** (`ChiHienQuan.integration.test.ts` exists — extend, plus component-level if the repo has a mount harness): pull button disabled without token; pity counter renders `player.companionPullsSinceRare`; exchange button disabled when DP short; result card renders `constellationRankAfter`.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/components/panels`.

---

## Task 10 — Standalone `companion` panel + wheel entry + mount

**Files:** `src/presentation/contracts/panelIds.ts`, `src/data/ui/commandWheelCatalog.ts`, `src/components/panels/CompanionPanel.vue` (create), `src/components/layout/GameRoot.vue`, locales.

- [x] `panelIds.ts`: add `| 'companion'` to `StandalonePanel`.
- [x] `commandWheelCatalog.ts`: entry beside `tran_phap` — `target: { kind: 'standalone', panel: 'companion' }`, always-available gate (companions have no realm gate per spec).
- [x] `CompanionPanel.vue`: self-gates on `ui.standalonePanel === 'companion'` (copy `TranPhapPanel`'s gating exactly), `OverlayPanel` shell. Content: roster grid grouped by grade → selected detail — name/grade/realm+tier, EXP bar (`exp / companionExpRequiredForLevel`), stats from `companionStatsAt`, 6 Cung Mệnh pips (lit ≤ `constellationRank`, perk names/tooltips for C2/C4/C6 locked vs unlocked), skill list with unlock state + threshold labels, feed control (material picker → `feedCompanion(instanceId, materialId, count)`, disabled at `level_maxed`), formation hint text pointing to Trận Pháp.
- [x] `GameRoot.vue`: `<CompanionPanel />` after `<TranPhapPanel />` + import.
- [x] i18n `companion.*` keys both locales.
- [x] **Tests:** panel renders owned companions; empty state when `companions` is `[]`; feed button disabled on maxed instance; wheel catalog entry resolves `panel: 'companion'`.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/components src/data/ui`.

---

## Task 11 — MVP roster + remove test-only content

**Files:** `src/data/companion/Companions.ts`, `src/components/panels/TranPhapPanel.vue`, any test referencing `TEST_COMPANIONS`/`test_companion_`.

- [x] Author 10 definitions — **4 hoang / 3 huyen / 2 dia / 1 thien / 0 tien** — tu-tiên themed (đạo sĩ, kiếm khách, linh thú…). Each: real `basic` (+`special`/`ultimate` where unlocked), `growthRate` by grade (proposal: hoang 0.04 / huyen 0.05 / dia 0.06 / thien 0.08 — balance constant, tune pass later), `unlockThresholds` (special ≈ qi_refining t1 for hoang, earlier realms for higher grades; ultimate foundation+), `constellationPerks` required on dia/thien at ranks 2/4/6 (mix of `stat` + `skill_override`), optional on lower grades. All skills must be expressible via existing `TurnSkillDefinition` fields — no new engine capabilities, no id-keyed branches (A8).
- [x] Delete `TEST_COMPANIONS`, `testCompanionBasicSkill`, `TEST_COMPANION_BASE_STATS`; `COMPANIONS` = the 10 real definitions.
- [x] Remove the test-grant button + handler in `TranPhapPanel.vue` (its comment block references `TEST_COMPANIONS` — remove together).
- [x] **Tests:** roster invariants — exactly 10 defs, grade distribution 4/3/2/1/0, unique ids, every def has `basic` with `targeting` + `cooldownTurns`, `unlockThresholds` reference valid `REALMS` ids and defined skills only (`special` threshold requires `special` skill present), `atRank` values ⊆ {2,4,6} and ≤ `MAX_CONSTELLATION_RANK`, `effectiveCompanionRates(COMPANION_BASE_RATES, COMPANIONS)` has `tien: 0`.
- [x] **Verify:** `npm run type-check` + `npx vitest run src/data/companion src/core/companion src/components/panels/TranPhapPanel`.

---

## Task 12 — Docs + full verification + QA gate

**Files:** `docs/systems/companions.md`, this plan (check off steps).

- [x] Update `companions.md` — gacha loop, Cung Mệnh, realm-capped progression, token sources, UI surfaces; remove obsolete "duplicate→exp"/`companionStatsAtLevel` mentions.
- [x] Self-audit: `grep` for `TEST_COMPANIONS`, `companionStatsAtLevel`, `grantCompanionExp`, `instance.level` — zero hits outside history docs.
- [x] **Full verify (P3 full — save schema + new files + UI):** `npm run type-check` && `npm run build` && `npx vitest run`.
- [x] Simplify pass → `tutienidle-adversarial-qa` (quick) → `code-review` — required before declaring done (P4/P5). P14 browser check for the two new UI surfaces is deferred-to-main-checkout if run inside a worktree.

---

## Notes for executors

- **Order matters:** 1→2→3→4 are sequential (schema → pure mechanics → gacha → ops). 5–8 can run in parallel after 4. 9–10 can run in parallel after 4 (they consume `PullCompanionResult`/`feedCompanion`). 11 needs 3 (effective rates) and ideally lands after 9–10 so the UI shows real content. 12 last.
- **`realmId` type is `string`** throughout `PlayerData`/`REALMS` — do not introduce a `RealmId` alias; the spec's use of it was loose.
- **`combatantId` stays `definitionId`** — the 1-1 invariant makes it unique; `instanceId` is for player-facing handles (feed/exchange), not formation keys.
- **Material `profession` meta:** `Material.profession?: ProfessionMaterialMeta` exists with a `realmId` field — feed EXP scales off `getRealmIndex(profession.realmId)`.
- **Worktree:** this is a multi-file feature → P2 requires an isolated worktree (`.agent-worktrees/companion-gacha`) before touching `src/**`. Docs-only edits (this file, spec) are exempt.

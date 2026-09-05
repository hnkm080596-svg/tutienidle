# Companion Roster System — Design Spec

**Date:** 2026-09-05
**Status:** Approved by user, ready for implementation plan.
**Depends on:** nothing shipped yet (new subsystem). Feeds into the not-yet-designed "Trận Pháp" formation spec (a separate spec, built next), which will let the player place owned companions into `PLAYER_SIDE_REGION` cells (see `docs/superpowers/specs/2026-09-05-combat-art-pipeline-rework-design.md` §6-§7).

## 1. Problem / Context

The game has never had more than one playable combatant — "the player" is a singleton throughout the codebase (`GameManager.activePlayer`, one flat `PlayerData` object, one equipment bag, one skill loadout). The user wants a real gacha-recruited companion roster: companions fight alongside the player, each with a fixed skill kit, gaining power through their own leveling track — and eventually placed into battle via a Trận Pháp (formation) panel the user is designing next.

## 2. Survey — why this is smaller than it first looks

A full-codebase survey for "assumes exactly one player" found three large, genuinely costly rework areas — and confirmed one already-sound area:

- **`PlayerData`** (`game/src/core/player/Player.ts:21-272`) is one flat object mixing account-level progression with per-character combat state — no array/map keyed by character.
- **`GameManager.activePlayer`** is a singleton read directly by ~30 call sites in `GameManager.ts` (skill casting, node levels, resource ticks, alchemy bonuses, autofarm, etc.).
- **Equipment/Skill-Loadout systems** (`EquipmentSlotManager`, `SkillManager`/`SkillLoadoutSlots.ts`) have no "owner" concept at all — equip state and loadout slots are implicitly "the player's."
- **Already fine, no change needed**: `BuffSystem.ts` (legacy) and the turn-based `TurnBuffSystem`/resource fields all key off `CombatEntity`/`TurnBattleParticipant` directly, not a global singleton — this is why companions can join actual combat cheaply.

**Decisions that avoid all three costly areas** (locked with the user, 2026-09-05):
1. Companions have **no equipment system** — stats scale from rarity (`grade`) + level only. Equipment ownership rework is fully avoided.
2. Companions have a **fixed skill kit** per definition (not the player's Ngũ Hành node-tree/loadout system) — `SkillManager`/`SkillLoadoutSlots.ts` need zero changes; a companion's `basic`/`special`/`ultimate` `TurnSkillDefinition`s are simply baked into its static content definition.
3. Companions level via their **own exp/material track**, entirely separate from the player's cultivation/realm system — no coupling to `PlayerData`'s complex realm/tu-vi fields.
4. Companions are **not added to `PlayerData`'s per-character struct or `GameManager.activePlayer`** — they're built fresh into a `CombatEntity`/`TurnBattleParticipant` at battle start, the same way enemies already are (see §5). `GameManager.activePlayer` stays exactly as it is today; nothing about the player's own 30 call sites changes.

Net effect: the ONLY new surface on existing systems is one new field on `PlayerData` (an owned-companion list) and one new content data file — everything else is new, additive code.

## 3. Rarity — reuse `ItemGrade`, not `ProfessionGrade`

The codebase has TWO different 5/10-tier ladders that are easy to confuse:
- `ProfessionGrade` (`game/src/core/profession/ProfessionGrade.ts`) — 10-tier `Cửu Phẩm → Tiên Phẩm`, tied to REALM, used only for crafting professions. **Not this one.**
- `ItemGrade` (`game/src/core/item/ItemGrade.ts`) — 5-tier `'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'`, labeled "Hoàng Chất → Tiên Chất" (terminology updated 2026-09-02 from an earlier "Phẩm" label — the type/field/values did NOT change, only the display string), already used for Equipment/Pill/Talisman/Formation quality. **This is the one to reuse** for companion rarity — consistent with the rest of the game's itemization vocabulary, zero new type needed.

## 4. Data Model

New file: `game/src/data/companion/Companions.ts` (mirrors the existing `game/src/data/enemy/Enemies.ts`/`game/src/data/skill/Skills.ts` content-definition style):

```ts
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade

  /** Base stats at level 1 — scaled by level via companionStatsAtLevel() (§6). */
  baseStats: {
    maxHp: number
    attack: number
    speed: number
    // ... additional base stat fields as needed, matching the subset of
    // StatBlock fields combat actually reads (armor, criticalRate, etc.)
  }

  /** Fixed skill kit — baked in, never player-editable (decision §2.2). */
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // content added later — this spec ships the mechanism, not the roster's
  // actual character list/names/kits (that's content work, see §8).
]
```

Owned-companion data — the ONLY new field on `PlayerData` (`game/src/core/player/Player.ts`):

```ts
export interface CompanionInstance {
  definitionId: string
  level: number
  exp: number
}

// Added to PlayerData interface:
companions: CompanionInstance[]
```

`createDefaultPlayer()` initializes `companions: []` (matches this project's established Pinia gotcha convention — memory `tienhiep-phap-tu-system`: always init optional/new `PlayerData` fields in `createDefaultPlayer()`, never leave `undefined` and rely on call-site fallback).

## 5. Combat Integration

New function, `companionToCombatEntity(instance: CompanionInstance, definition: CompanionDefinition): CombatEntity`, mirroring the existing `playerToCombatEntity()` (`core/player/Player.ts:364`) and enemy-spawn (`resolveEnemySpawnPosition` + enemy-entity-building) patterns:

- Builds a fresh `CombatEntity` each battle (id = `companion:${definitionId}` or similar, not persisted beyond the fight — matches this project's "combat state is ephemeral" principle already used for `TurnBattle.log`/enemy entities).
- Stats = `companionStatsAtLevel(definition.baseStats, instance.level)` — a simple, deterministic scaling formula (exact curve is content-tuning, out of scope here; the function signature/shape is the contract).
- `basic`/`special`/`ultimate` copied directly from `definition` — no cooldown/resource wiring beyond what `TurnSkillDefinition` already models for any combatant.
- Position: NOT decided by this spec — the Trận Pháp spec (next) owns "which companion goes in which cell"; this spec only guarantees `companionToCombatEntity()` produces a valid `TurnBattleParticipant` that `GameManager.buildTurnBattle()`'s `players` array (already becoming data-driven per the Combat Art Pipeline spec's `PartyFormationSlot[]`) can include alongside the player's own entity.
- Targeting/AI: companions are always auto-controlled (no manual input) — Slice 7's manual-cast UI stays scoped to the player only; this spec does not extend `awaitedManualActor`/`submitTurnChoice` to companions.

## 6. Leveling

- `CompanionInstance.exp` accumulates from a source to be named in a later content pass (battle rewards, a dedicated "companion training" material, or both) — mechanism only: `grantCompanionExp(instance, amount)` + `companionLevelForExp(exp)` (simple table/formula, exact curve is content-tuning).
- `companionStatsAtLevel(baseStats, level)` — linear or curve-based scaling (exact formula deferred to content/balance pass, same as `TU_LINH_TRAN_BUFF_PERCENT`-style economy constants elsewhere in this codebase live in their own small balance-constant file, not hardcoded inline).

## 7. Gacha / Summon Mechanism

- New currency (name/acquisition deferred to content) spent on a pull.
- Rate table keyed by `ItemGrade` (5 tiers) — exact percentages are a balance/content decision, out of scope for this spec; the mechanism needs a `rollCompanionGrade(rates: Record<ItemGrade, number>): ItemGrade` pure function plus a `pickDefinitionOfGrade(grade): CompanionDefinition` selector.
- Duplicate pulls (already-owned `definitionId`): convert to exp/shard for that companion rather than a no-op or a second copy — feeds directly into §6's leveling track.
- No pity-system/rate-up-banner mechanics are designed here — flagged as a content/live-ops decision for later if needed (§8).

## 8. Out of Scope

- The actual roster content: how many companions, their names/lore/exact skill kits/base stats/grade assignment — pure content work, follows this mechanism once built (same "mechanism first, content later" pattern used throughout this rework).
- Exact leveling curve, gacha rate table, pull currency name/acquisition — balance/content decisions.
- Pity system, rate-up banners, or any live-ops gacha mechanic beyond a flat rate table.
- The Trận Pháp formation panel itself (drag-and-drop UI, valid-cell patterns per formation, buff-by-headcount) — separate spec, consumes `player.companions`/`companionToCombatEntity()` from this one.
- Any UI for viewing/managing the roster (a roster list screen, companion detail panel) — needed before Trận Pháp's card-based picker can work in practice, but is its own scoped UI task for the plan to size, not a design decision here.
- Multi-character equipment, per-character skill trees, or any retrofit of the ~35+ UI panels the survey found assuming a singular player — none of that is needed because companions deliberately don't have equipment or player-style skill progression.

## 9. Risks / Notes for the Plan

- `TurnBattleSystem`'s win/loss check (`battle.players.every((member) => !member.entity.alive)`, confirmed at `TurnBattleSystem.ts:687`) already generalizes correctly over an array — adding companion participants to `players[]` needs no change there. Confirm this holds for every other `battle.players`/`turnBattle.players` consumer found during the earlier defect-fix review before assuming zero engine-side changes.
- `GameManager.buildTurnBattle()` currently hardcodes `players: [playerParticipant]` (per the Combat Art Pipeline spec's own findings) — that spec's `PartyFormationSlot[]`-driven rewrite is a PREREQUISITE for this spec's companions to actually appear in a real battle. Sequence the plans accordingly (Combat Art Pipeline's party-array work should land before or alongside this).
- `companionToCombatEntity()`'s stat-scaling formula and the gacha rate table are both named as pure functions specifically so a future balance pass can tune them without touching combat-integration code — the plan should keep them in small, isolated files (matching this project's established "balance constants live in their own file" convention), not inline in `GameManager.ts`.
- Confirm `TurnSkillDefinition` (from `TurnSkillAction.ts`) has everything a companion's fixed kit needs (cooldown, targeting, damage) without requiring the `resourceType`/`resourceCost` machinery built for the player's Ngũ Hành resources — companions likely want `resourceType: undefined` (free-cast, cooldown-gated only) rather than inventing a companion-specific resource pool, but the plan should verify this reads cleanly through `declareActorAction()`'s existing resource-check code rather than assuming.

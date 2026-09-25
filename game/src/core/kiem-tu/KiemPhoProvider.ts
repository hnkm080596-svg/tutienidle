import type { PlayerData } from '../player/Player'
import type { DynamicBasicProvider, TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { KiemPhoBattleState, KiemPhoCombo, KiemPhoComboModifier } from './KiemPhoSystem'
import { initKiemPhoBattle, nextOrb, realmComboMax, recordCastAndMatch } from './KiemPhoSystem'
import {
  applySkillDefinitionModifiers,
  type KiemPhoSkillDefinitionModifier,
} from './KiemPhoNodeModifiers'
import type { OrbId } from './KiemTuState'
import { getRealmIndex } from '../realm/realmSystem'
import { KIEM_PHO_ORBS, unlockedOrbs } from '../../data/skill/KiemPhoOrbs'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'

// Kiem Tu Reimagined Task 6 — the sword_pathway (Kiem Pho) DynamicBasicProvider.
// Owns the battle-scoped matcher state (preset snapshot + cursor + log)
// in closure — A3: never on PlayerData, never persisted. Auto-repeat
// reuses participants, so resetForBattle() re-inits from the persisted
// preset (spec §4.1: cursor starts at slot 1, log empty).

function isOrbId(skillId: string): skillId is OrbId {
  return skillId in KIEM_PHO_ORBS
}

function comboToExtraDef(combo: KiemPhoCombo, triggeringOrbId: string): TurnSkillDefinition {
  return {
    id: combo.id,
    cooldownTurns: 0,
    damage: combo.damage
      ? // M-QI-05 - generated combo damage consumes the inherited owner
        // level (progressionOwnerId below), +5%/level like every
        // damage-bearing native channel.
        { kind: 'physical', multiplier: combo.damage.multiplier, levelScaling: 0.05 }
      : undefined,
    // Spec §4.2 default: same target as the completing cast — 'single'
    // re-collects the deterministic primary target in applyExtraImpact.
    targeting: combo.targeting ?? { shape: 'single' },
    appliesBuffs: combo.appliesBuffs?.map((buff) => ({ ...buff })),
    // Kiem Pho Beta - Thau Ngan's stack-scaled hit and the seal
    // interactions (Liet Ngan stacks, Diep Ngan manual trigger, Kiem
    // Ket extensions, Lien Thuc triggers) ride the same extra-impact
    // payload, phase-ordered by applyModifiers.
    scalesWithAilmentStacks: combo.scalesWithAilmentStacks
      ? { ...combo.scalesWithAilmentStacks }
      : undefined,
    ailmentInteractions: combo.ailmentInteractions ? [...combo.ailmentInteractions] : undefined,
    presetId: combo.presetId,
    // M-QI-05 - the combo payload inherits the triggering orb's Core
    // level (QI-D3 internal-action ownership), never its own id.
    progressionOwnerId: triggeringOrbId,
  }
}

/**
 * Read-only peek handle for HUD bridges (Task 7): exposes a DETACHED
 * copy of the battle-runtime matcher state (preset snapshot, cursor,
 * log). Kept off the generic DynamicBasicProvider contract — content
 * reads belong to the owning provider (A8).
 */
export interface KiemPhoProviderHandle extends DynamicBasicProvider {
  snapshot(): KiemPhoBattleState
}

// The extra-impact deal_damage ops carry the bare combo id as originId.
// This derived view exposes the combo ids REACHABLE at a realm - a
// combo can only fire when every orb in its pattern is realm-unlocked -
// so provenance surfaces (the simulation metric lane) classify combo
// damage without reading the owner-sealed catalog (INV-7) or hardcoding
// literals, and unreachable higher-realm combos classify as leakage
// rather than kit.
export function reachableKiemPhoComboIds(realmId: string): readonly string[] {
  const realmIndex = getRealmIndex(realmId)
  const unlocked = new Set(unlockedOrbs(realmIndex))
  const maxLen = realmComboMax(realmIndex)
  return KIEM_PHO_COMBOS
    .filter((c) => c.pattern.length <= maxLen && c.pattern.every((orb) => unlocked.has(orb)))
    .map((c) => c.id)
}

export function isKiemPhoProviderHandle(
  provider: DynamicBasicProvider | undefined,
): provider is KiemPhoProviderHandle {
  return typeof (provider as KiemPhoProviderHandle | undefined)?.snapshot === 'function'
}

export function buildKiemPhoProvider(
  player: PlayerData,
  modifiers: readonly KiemPhoComboModifier[],
  // Kiem Pho Beta (design sec.10/15) - Can / Thuan Thuc node effects
  // folded into orb def copies at emit. Memoized per orb: node levels
  // never change mid-battle, so auto/manual always emit the identical
  // def object (INV-13).
  skillModifiers: readonly KiemPhoSkillDefinitionModifier[] = [],
): KiemPhoProviderHandle {
  let state: KiemPhoBattleState = initKiemPhoBattle(player)
  const foldedDefs = new Map<OrbId, TurnSkillDefinition>()
  const orbDef = (orb: OrbId): TurnSkillDefinition | undefined => {
    const def = KIEM_PHO_ORBS[orb]
    if (!def) return undefined
    const cached = foldedDefs.get(orb)
    if (cached) return cached
    const folded = applySkillDefinitionModifiers(def, skillModifiers)
    foldedDefs.set(orb, folded)
    return folded
  }
  const manualDefs = (): TurnSkillDefinition[] =>
    unlockedOrbs(getRealmIndex(player.realmId))
      .map(orbDef)
      .filter((d): d is TurnSkillDefinition => d !== undefined)

  return {
    resolveBasic(participant: TurnBattleParticipant): TurnSkillDefinition | undefined {
      void participant
      const orb = nextOrb(state)
      return orb === undefined ? undefined : orbDef(orb)
    },

    manualOptions(): readonly TurnSkillDefinition[] {
      return manualDefs()
    },

    resolveManualPick(defId: string): TurnSkillDefinition | null {
      if (!isOrbId(defId)) return null
      const def = orbDef(defId)
      // Manual pick validates against realm-unlocked options only; the
      // cast lands in the log via onCastResolved — the cursor does NOT
      // advance (spec §4.1: resuming auto continues where it left off).
      return def !== undefined && manualDefs().includes(def) ? def : null
    },

    resetForBattle(): void {
      state = initKiemPhoBattle(player)
    },

    snapshot(): KiemPhoBattleState {
      return { ...state, preset: [...state.preset], log: [...state.log] }
    },

    onCastResolved(ctx): readonly TurnSkillDefinition[] {
      if (!isOrbId(ctx.resolvedSkillId)) return []
      const combo = recordCastAndMatch(state, ctx.resolvedSkillId, KIEM_PHO_COMBOS, modifiers)
      return combo ? [comboToExtraDef(combo, ctx.resolvedSkillId)] : []
    },
  }
}

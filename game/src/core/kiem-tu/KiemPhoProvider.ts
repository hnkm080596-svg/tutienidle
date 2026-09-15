import type { PlayerData } from '../player/Player'
import type { DynamicBasicProvider, TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { KiemPhoBattleState, KiemPhoCombo, KiemPhoComboModifier } from './KiemPhoSystem'
import { initKiemPhoBattle, nextOrb, recordCastAndMatch } from './KiemPhoSystem'
import type { OrbId } from './KiemTuState'
import { getRealmIndex } from '../realm/realmSystem'
import { KIEM_PHO_ORBS, unlockedOrbs } from '../../data/skill/KiemPhoOrbs'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'

// Kiem Tu Reimagined Task 6 — the hien (Kiem Pho) DynamicBasicProvider.
// Owns the battle-scoped matcher state (preset snapshot + cursor + log)
// in closure — A3: never on PlayerData, never persisted. Auto-repeat
// reuses participants, so resetForBattle() re-inits from the persisted
// preset (spec §4.1: cursor starts at slot 1, log empty).

function isOrbId(skillId: string): skillId is OrbId {
  return skillId in KIEM_PHO_ORBS
}

function comboToExtraDef(combo: KiemPhoCombo): TurnSkillDefinition {
  return {
    id: combo.id,
    cooldownTurns: 0,
    damage: combo.damage
      ? { kind: 'physical', multiplier: combo.damage.multiplier }
      : undefined,
    // Spec §4.2 default: same target as the completing cast — 'single'
    // re-collects the deterministic primary target in applyExtraImpact.
    targeting: combo.targeting ?? { shape: 'single' },
    appliesBuff: combo.appliesBuff
      ? {
          definitionId: combo.appliesBuff.definitionId,
          target: combo.appliesBuff.target,
          stacks: combo.appliesBuff.stacks,
        }
      : undefined,
    presetId: combo.presetId,
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

export function isKiemPhoProviderHandle(
  provider: DynamicBasicProvider | undefined,
): provider is KiemPhoProviderHandle {
  return typeof (provider as KiemPhoProviderHandle | undefined)?.snapshot === 'function'
}

export function buildKiemPhoProvider(
  player: PlayerData,
  modifiers: readonly KiemPhoComboModifier[],
): KiemPhoProviderHandle {
  let state: KiemPhoBattleState = initKiemPhoBattle(player)
  const manualDefs = (): TurnSkillDefinition[] =>
    unlockedOrbs(getRealmIndex(player.realmId)).map(orb => KIEM_PHO_ORBS[orb])

  return {
    resolveBasic(participant: TurnBattleParticipant): TurnSkillDefinition {
      void participant
      return KIEM_PHO_ORBS[nextOrb(state)]
    },

    manualOptions(): readonly TurnSkillDefinition[] {
      return manualDefs()
    },

    resolveManualPick(defId: string): TurnSkillDefinition | null {
      if (!isOrbId(defId)) return null
      const def = KIEM_PHO_ORBS[defId]
      // Manual pick validates against realm-unlocked options only; the
      // cast lands in the log via onCastResolved — the cursor does NOT
      // advance (spec §4.1: resuming auto continues where it left off).
      return manualDefs().includes(def) ? def : null
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
      return combo ? [comboToExtraDef(combo)] : []
    },
  }
}

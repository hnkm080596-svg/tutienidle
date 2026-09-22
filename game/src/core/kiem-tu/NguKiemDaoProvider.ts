import type { PlayerData } from '../player/Player'
import type { DynamicBasicProvider, TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { HitResolveOptions } from '../battle/ActionImpactSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { nodeWayApplies } from '../progression/NodeSystem'
import { getRealmIndex } from '../realm/realmSystem'
import {
  CASCADE_CRIT_CHANCE,
  CASCADE_PIERCE_CHANCE,
  EXECUTE_MULT,
  PIERCE_FRACTION,
  gainKiemY,
} from './NguKiemDao'
import { NGU_KIEM_THUAT } from '../../data/skill/NguKiemDaoSkills'

// Kiem Tu Reimagined Task 9 (spec §5.2) — the hidden_sword_pathway (Ngu Kiem Dao)
// DynamicBasicProvider. resolveBasic live-reads kiemDaoBase /
// kiemDaoCount from PlayerData EVERY cast — a mid-battle forge is
// immediately reflected (there is no battle-scoped state to reset:
// count/base are persisted domain state, not runtime).
//
// Roll Cascade (spec §5.2) resolves per sword instance against the
// LIVE target via instances.perInstanceOptions:
//   Roll 1 (a): execute — hp% < min(0.5, 0.1 * realmIndex) → ×EXECUTE_MULT
//   Roll 2 (e): crit    — rng() < CASCADE_CRIT_CHANCE → critical
//   Roll 3 (d): armor   — rng() < CASCADE_PIERCE_CHANCE → armorBypass,
//               else armorPierceFraction = PIERCE_FRACTION
// guaranteedHit is unconditional — phi kiem never miss.
// All rolls go through the injected rng (replay determinism + tests).

export interface KiemDaoCascadeUnlocks {
  a: boolean
  e: boolean
  d: boolean
}

/**
 * Purchased nodes → cascade unlocks (spec §5.2 a/e/d). Effect-driven:
 * any node carrying `effect.cascadeUnlock` contributes its slot — the
 * authored ids live in KiemTuNodes data, not here.
 */
export function collectKiemDaoCascadeUnlocks(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): KiemDaoCascadeUnlocks {
  const unlocks: KiemDaoCascadeUnlocks = { a: false, e: false, d: false }

  for (const node of nodes) {
    const slot = node.effect.cascadeUnlock

    // M3 — the way-membership gate applies here too (this collector
    // reads nodeLevels directly): a wrong-way level must not unlock a
    // cascade slot.
    if (slot && (player.nodeLevels?.[node.id] ?? 0) > 0 && nodeWayApplies(player, node)) {
      unlocks[slot] = true
    }
  }

  return unlocks
}

export function buildNguKiemDaoProvider(
  player: PlayerData,
  unlocks: KiemDaoCascadeUnlocks,
  rng: () => number = Math.random,
): DynamicBasicProvider {
  const perInstanceOptions = (
    _instanceIndex: number,
    target: CombatEntity,
  ): Partial<HitResolveOptions> => {
    const options: Partial<HitResolveOptions> = { guaranteedHit: true }

    if (unlocks.a) {
      const threshold = Math.min(0.5, 0.1 * getRealmIndex(player.realmId))
      const hpRatio = target.maxHp > 0 ? target.currentHp / target.maxHp : 1

      if (hpRatio < threshold) {
        options.damageMultiplier = EXECUTE_MULT
      }
    }

    if (unlocks.e && rng() < CASCADE_CRIT_CHANCE) {
      options.critical = true
    }

    if (unlocks.d) {
      if (rng() < CASCADE_PIERCE_CHANCE) {
        options.armorBypass = true
      } else {
        options.armorPierceFraction = PIERCE_FRACTION
      }
    }

    return options
  }

  const resolveDef = (): TurnSkillDefinition => ({
    ...NGU_KIEM_THUAT,
    // M-QI-05 - spread the authored damage so adapter metadata
    // (levelScaling) survives; only the live multiplier is overridden.
    damage: NGU_KIEM_THUAT.damage
      ? { ...NGU_KIEM_THUAT.damage, multiplier: player.swordPath?.kiemDaoBase ?? 1 }
      : undefined,
    instances: {
      count: player.swordPath?.kiemDaoCount ?? 1,
      perInstanceOptions,
      // Skill-definition M4 -- declarative mirror of the closure above;
      // LegacySkillAdapter lifts `each` into SkillInstances.each (the
      // closure remains the legacy resolveDeclaredHit lane's authority).
      each: {
        guaranteedHit: true,
        ...(unlocks.a
          ? {
              execute: {
                hpPercentBelow: Math.min(0.5, 0.1 * getRealmIndex(player.realmId)),
                damageMultiplier: EXECUTE_MULT,
              },
            }
          : {}),
        ...(unlocks.e ? { critChance: CASCADE_CRIT_CHANCE } : {}),
        ...(unlocks.d
          ? {
              armorPierce: {
                bypassChance: CASCADE_PIERCE_CHANCE,
                pierceFraction: PIERCE_FRACTION,
              },
            }
          : {}),
      },
    },
  })

  return {
    resolveBasic: () => resolveDef(),

    manualOptions: () => [resolveDef()],

    resolveManualPick: (defId: string) => (defId === NGU_KIEM_THUAT.id ? resolveDef() : null),

    // hidden_sword_pathway owns no battle-scoped cursor/log — nothing to reset.
    resetForBattle: () => {},

    // +1 Kiem Y per resolved cast — the domain owner call lives HERE
    // (the provider), never in the generic GameManager cast sink.
    onCastResolved: () => {
      gainKiemY(player, 1)
      return []
    },
  }
}

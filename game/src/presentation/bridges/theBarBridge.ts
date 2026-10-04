// Phap Tu Reimagine (spec D17) -- The bar HUD for the normal Phap Tu
// path, updated EVERY FRAME via CombatScene.update() (poll, NOT event
// emit - same contract as kiemBarBridge.ts).
//
// Architecture: CombatScene (Phaser) only talks to the core through the
// registry - it never holds GameManager. The reader is registered from
// PhaserCanvas (which already has gameManager + player store); the
// scene calls it through the registry key each frame.
//
// Reimagined contract: the pool is a flat 5 (cap == threshold -- the old
// 100-essence + raised-cap machinery is retired). 'phapTheActive' is the
// PHAP THE indicator: the element Basic carries an empowerment variant
// AND the pool is full -- the next Basic declares empowered without
// consuming the pool.
//
// Reader returns null when there is no live battle, the way is not
// spell_pathway (hidden_spell_pathway owns NO The pool - spec P6), or no element has
// been committed -> CombatScene hides the bar.

import { MAX_THE } from '@/core/combat/CombatTypes'
import { isQuaTheDebt } from '@/core/the-tu/TheEconomy'
import { hasQuanTheMarker } from '@/data/buff/TheTuBuffs'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import type { SpellPathState } from '@/core/phap-tu/PhapTuState'
import type { CultivationPathId, CultivationWayId } from '@/core/player/CultivationPathKit'
import { HOA_THE_NODE_ID, SPELL_PATH_MAX_THE } from '@/core/phap-tu/PhapTuPath'
import {
  getActiveElement,
  hasStaticPathCapability,
} from '@/core/player/CultivationPathSystem'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

/** The reimagined pool is a flat 5 (spec D8/D17) -- the canonical
 * cap lives in PhapTuPath (SPELL_PATH_MAX_THE, single owner); the HUD
 * never renders a different cap. */
export const THE_BAR_MAX = SPELL_PATH_MAX_THE

export interface TheBarSnapshot {
  current: number

  /** Fixed cap -- 5 (spec D8; the truong_the raised-cap path is gone). */
  max: number

  /** Empowerment threshold -- identical to max under the reimagined pool. */
  threshold: number

  /** PHAP THE indicator (D17): the element basic carries an empowerment
   *  variant AND the pool is full. The empowered swap consumes nothing --
   *  the flag only lights the HUD marker. */
  phapTheActive: boolean

  label: string

  /** Ung The beta - entity id of the live Tham An mark (undefined = no
      focus). */
  thamTargetId?: string

  /** Ung The beta - quan_the marker live on the player. */
  quanTheActive?: boolean

  /** Ung The beta - current Ung Tre reaction debt. */
  reactionDebt?: number

  /** Ung The beta - Qua The (debt at cap); computed against
      isQuaTheDebt here so views never re-derive the predicate. */
  quaThe?: boolean
}

export type TheBarReader = () => TheBarSnapshot | null

export const THE_BAR_READER_KEY = 'theBarReader' as const

/** Structural slice of the player store this reader needs - the bridge
 * stays free of Vue/Pinia imports so scenes never drag the store in. */
export interface TheBarPlayerState {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: CultivationWayId | null
  spellPath: SpellPathState
  nodeLevels: Record<string, number>
}

/**
 * Read the live The-bar snapshot. null = hide the bar. Path and element
 * come from player state (single authority); the pool lives on the
 * battle entity (battle-scoped, INV-14).
 */
export function makeTheBarReader(
  gameManager: GameManager,
  getPlayer: () => TheBarPlayerState,
): TheBarReader {
  return () => {
    const battle = gameManager.getTurnBattle()

    if (!battle || !isBattleInProgress(battle.state)) {
      return null
    }

    const player = getPlayer()

    // Ung The beta -- the pool also belongs to hidden_body_pathway
    // ('body.essence_economy'); element gate is spell-only.
    const bodyEconomy = hasStaticPathCapability(player, 'body.essence_economy')

    // M4 (R6): the The pool is spell_pathway machinery - P1 - the declared
    // 'spell.essence_pool' capability is the gate, durable for the
    // collapsed ('spell','hidden_spell_pathway') shape.
    if (!bodyEconomy && !hasStaticPathCapability(player, 'spell.essence_pool')) {
      return null
    }

    if (!bodyEconomy) {
      // Canonical subpath read - the committed element under the owning
      // way's axis (undefined for hidden_spell_pathway / uncommitted / corrupt pairs).
      const element = getActiveElement(player)

      if (!element) {
        return null
      }

      // Hoa The gate (Minh ruling 2026-10-04): the pool comes online
      // with the hoa_the node purchase - no node, no bar at all.
      if ((player.nodeLevels?.[HOA_THE_NODE_ID] ?? 0) <= 0) {
        return null
      }
    }

    // TurnBattle participant shape - the human player's CombatEntity is
    // players[0].entity (The pool lives on CombatEntity, battle-scoped).
    const battleParticipant = battle.players[0]
    const battleEntity = battleParticipant?.entity

    if (!battleParticipant || !battleEntity) {
      return null
    }

    const current = battleEntity.currentThe ?? 0
    const max = battleEntity.maxThe ?? (bodyEconomy ? MAX_THE : THE_BAR_MAX)
    const threshold = battleParticipant.basic?.empowerment?.theThreshold ?? max

    if (bodyEconomy) {
      // Ung The beta HUD (design Part XV): The bar + Tham focus + Quan
      // The state + Ung Tre/Qua The feedback. No empowerment marker --
      // threshold 0 keeps the tick hidden.
      return {
        current,
        max,
        threshold: 0,
        phapTheActive: false,
        label: 'Thế',
        thamTargetId: battleParticipant.thamTargetId,
        quanTheActive: hasQuanTheMarker(gameManager.getBattleBuffs(battleEntity.id)),
        reactionDebt: battleParticipant.reactionDebt ?? 0,
        quaThe: isQuaTheDebt(battleParticipant.reactionDebt),
      }
    }


    // D17 -- Phap The presence is a live read of the resolved element
    // basic: buildPhapTheVariant() attaches `empowerment` onto the def the
    // participant carries. Before the element commit (or on a basic with
    // no variant) the flag can never light. Re-evaluates the same
    // currentThe >= theThreshold predicate the engine gates on
    // (TurnBattleSystem ~1811, SkillResolver ~225) -- a display mirror
    // reading the same stamped field; drifts only if the engine gate
    // moves to a different source.
    const phapTheActive = battleParticipant.basic?.empowerment !== undefined && current >= threshold

    return { current, max, threshold, phapTheActive, label: 'Thế' }
  }
}

export function registerTheBarReader(registry: GateRegistry, reader: TheBarReader): void {
  writeGate(registry, THE_BAR_READER_KEY, reader)
}

export function readTheBar(registry: GateRegistry): TheBarSnapshot | null {
  const reader = readOptionalGate(registry, THE_BAR_READER_KEY)

  if (!reader) {
    return null
  }

  return reader()
}

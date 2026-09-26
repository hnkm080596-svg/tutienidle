// Phap Tu Reimagine (spec D17) -- The bar HUD for the normal Phap Tu
// path, updated EVERY FRAME via CombatScene.update() (poll, NOT event
// emit — same contract as kiemBarBridge.ts).
//
// Architecture: CombatScene (Phaser) only talks to the core through the
// registry — it never holds GameManager. The reader is registered from
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
// spell_pathway (hidden_spell_pathway owns NO The pool — spec P6), or no element has
// been committed -> CombatScene hides the bar.

import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import type { SpellPathState } from '@/core/phap-tu/PhapTuState'
import type { CultivationPathId, CultivationWayId } from '@/core/player/CultivationPathKit'
import {
  getActiveElement,
  hasStaticPathCapability,
} from '@/core/player/CultivationPathSystem'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

/** The reimagined pool is a flat 5 (spec D8/D17) -- the pathway's
 * resolveMaxThe() read site lives in PhapTuPath; the HUD never renders
 * a different cap. */
export const THE_BAR_MAX = 5

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
}

export type TheBarReader = () => TheBarSnapshot | null

export const THE_BAR_READER_KEY = 'theBarReader' as const

/** Structural slice of the player store this reader needs — the bridge
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

    // M4 (R6): the The pool is spell_pathway machinery - P1 - the declared
    // 'spell.essence_pool' capability is the gate, durable for the
    // collapsed ('spell','hidden_spell_pathway') shape.
    if (!hasStaticPathCapability(player, 'spell.essence_pool')) {
      return null
    }

    // Canonical subpath read - the committed element under the owning
    // way's axis (undefined for hidden_spell_pathway / uncommitted / corrupt pairs).
    const element = getActiveElement(player)

    if (!element) {
      return null
    }

    // TurnBattle participant shape — the human player's CombatEntity is
    // players[0].entity (The pool lives on CombatEntity, battle-scoped).
    const participant = battle.players[0]
    const battleEntity = participant?.entity

    if (!battleEntity) {
      return null
    }

    const current = battleEntity.currentThe ?? 0

    // D17 -- Phap The presence is a live read of the resolved element
    // basic: buildPhapTheVariant() attaches `empowerment` onto the def the
    // participant carries. Before the element commit (or on a basic with
    // no variant) the flag can never light.
    const phapTheActive = participant?.basic?.empowerment !== undefined && current >= THE_BAR_MAX

    return { current, max: THE_BAR_MAX, threshold: THE_BAR_MAX, phapTheActive, label: 'Thế' }
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

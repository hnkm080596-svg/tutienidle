// Phap Tu Reimagined (Task 16) — The bar HUD for the normal Phap Tu
// path, updated EVERY FRAME via CombatScene.update() (poll, NOT event
// emit — same contract as kiemBarBridge.ts).
//
// Architecture: CombatScene (Phaser) only talks to the core through the
// registry — it never holds GameManager. The reader is registered from
// PhaserCanvas (which already has gameManager + player store); the
// scene calls it through the registry key each frame.
//
// Reader returns null when there is no live battle, the way is not
// ngu_hanh (ngo_dao owns NO The pool — spec P6), or no element has
// been committed -> CombatScene hides the bar.

import { MAX_THE } from '@/core/combat/CombatTypes'
import { PHAP_TU_EMPOWERMENT_THE_THRESHOLD } from '@/core/phap-tu/PhapTuRoutes'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import type { PhapTuState } from '@/core/phap-tu/PhapTuState'
import type { CultivationPathId, PathWayId } from '@/core/player/CultivationPathKit'
import {
  getActiveElement,
  hasStaticPathCapability,
} from '@/core/player/CultivationPathSystem'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

export interface TheBarSnapshot {
  current: number

  /** resolveMaxThe() snapshot — may exceed the threshold via truong_the. */
  max: number

  /** Empowerment marker (spec P13) — a fixed 100, NOT max. */
  threshold: number

  /** phap-tuong unlock owned (linh_ngo_<godUlt>) — the ult empowers. */
  empowered: boolean

  label: string
}

export type TheBarReader = () => TheBarSnapshot | null

export const THE_BAR_READER_KEY = 'theBarReader' as const

/** Structural slice of the player store this reader needs — the bridge
 * stays free of Vue/Pinia imports so scenes never drag the store in. */
export interface TheBarPlayerState {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: PathWayId | null
  phapTu: PhapTuState
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

    // M4 (R6): the The pool is ngu_hanh machinery - P1 - the declared
    // 'phap_tu.the_pool' capability is the gate, durable for the
    // collapsed ('phap_tu','ngo_dao') shape.
    if (!hasStaticPathCapability(player, 'phap_tu.the_pool')) {
      return null
    }

    // Canonical subpath read - the committed element under the owning
    // way's axis (undefined for ngo_dao / uncommitted / corrupt pairs).
    const element = getActiveElement(player)

    if (!element) {
      return null
    }

    // TurnBattle participant shape — the human player's CombatEntity is
    // players[0].entity (The pool lives on CombatEntity, battle-scoped).
    const battleEntity = battle.players[0]?.entity

    if (!battleEntity) {
      return null
    }

    const current = battleEntity.currentThe ?? 0
    const max = battleEntity.maxThe ?? MAX_THE

    // Empowered = the phap-tuong unlock node for this element is owned;
    // at threshold the ult consumes the whole pool (spec section 3.3). P1 -
    // node ownership surfaces as the 'phap_tu.empowered_ult' capability;
    // the bridge reads it through the bound facade (SkillManager is not
    // a bridge dependency).
    const empowered = gameManager.hasPathCapability('phap_tu.empowered_ult')

    return { current, max, threshold: PHAP_TU_EMPOWERMENT_THE_THRESHOLD, empowered, label: 'Thế' }
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

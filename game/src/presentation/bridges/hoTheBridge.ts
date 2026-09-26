// Phap Tu Reimagine (spec F13) -- Linh Luc Ho The (mana shield) live
// readout for the combat status tooltip. The DR is NOT a fixed number:
// it scales cap * currentMp/maxMp, so the only honest surface is a live
// read per tooltip open -- a bridge reader (same registry-poll contract
// as theBarBridge.ts).
//
// Reader returns null when there is no live battle or the player entity
// carries no linhLucHoTheCap (pre-unlock / non-spell path) -- the tooltip
// line simply does not appear. No second shield bar (design sec.88).

import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

export interface HoTheSnapshot {
  /** Authored DR ceiling -- the `linhLucHoTheCap` stat (fraction). */
  cap: number

  /** Live damage reduction: cap * currentMp/maxMp (0 when LL is empty). */
  dr: number
}

export type HoTheReader = () => HoTheSnapshot | null

export const HO_THE_READER_KEY = 'hoTheReader' as const

/** The stat lands with the ENGINE slice -- structural read keeps this
 * file compiling before the Stats type carries `linhLucHoTheCap`. */
type HoTheStats = { linhLucHoTheCap?: number; maxMp: number }

export function makeHoTheReader(gameManager: GameManager): HoTheReader {
  return () => {
    const battle = gameManager.getTurnBattle()

    if (!battle || !isBattleInProgress(battle.state)) {
      return null
    }

    const entity = battle.players[0]?.entity

    if (!entity) {
      return null
    }

    const cap = (entity.stats as HoTheStats).linhLucHoTheCap ?? 0

    if (cap <= 0) {
      return null
    }

    const maxMp = entity.stats.maxMp
    const mpRatio = maxMp > 0 ? Math.min(1, Math.max(0, entity.currentMp / maxMp)) : 0

    return { cap, dr: cap * mpRatio }
  }
}

export function registerHoTheReader(registry: GateRegistry, reader: HoTheReader): void {
  writeGate(registry, HO_THE_READER_KEY, reader)
}

export function readHoThe(registry: GateRegistry): HoTheSnapshot | null {
  const reader = readOptionalGate(registry, HO_THE_READER_KEY)

  if (!reader) {
    return null
  }

  return reader()
}

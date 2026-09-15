// Kiem Tu Reimagined Task 7 — Kiếm bar HUD bridge. Reads the CANONICAL
// PlayerData.kiemTu state (K1), not the retired kiemTuRoute pools.
// Updated EVERY FRAME via CombatScene.update() polling (no event emit —
// CombatDefeatPanel/CombatVictoryPanel unchanged).
//
// Architecture: CombatScene (Phaser) talks to core only through the
// registry gate (see PhaserCanvas.vue) — the reader is registered by
// PhaserCanvas (which owns gameManager + the player store) and polled
// per frame, same pattern as 'eventBus' / 'lastBattlePositionsSnapshot'.
//
// Reader returns null when there is no in-progress battle or the player
// is not on the Kiem Tu path → CombatScene hides the bar.
//
// hien (Kiem Pho): the bar shows preset-strip progress — `current` is
// the auto cursor position, `max` the preset length, plus the orb strip
// + cast log for presentation layers that render richer HUD.
// ngu (Ngu Kiem Dao): the bar shows persisted Kiem Y progress toward
// the current realm's forgeCost, plus live sword count/base multiplier.

import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { OrbId, KiemTuState } from '@/core/kiem-tu/KiemTuState'
import { isKiemPhoProviderHandle } from '@/core/kiem-tu/KiemPhoProvider'
import { forgeCost } from '@/core/kiem-tu/NguKiemDao'
import { getRealmIndex } from '@/core/realm/realmSystem'
import type { GameManager } from '@/core/game/GameManager'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

export interface KiemBarSnapshot {
  current: number
  max: number
  label: string
  /** Hien preset strip: the persisted orb loop + the auto cursor. */
  mode?: 'hien' | 'ngu'
  preset?: readonly OrbId[]
  cursor?: number
  nextOrb?: OrbId
  log?: readonly OrbId[]
  /** Ngu readout: live flying swords + permanent base multiplier. */
  kiemDaoCount?: number
  kiemDaoBase?: number
}

export type KiemBarReader = () => KiemBarSnapshot | null

export const KIEM_BAR_READER_KEY = 'kiemBarReader' as const

/** Phần state player mà reader cần — structural, không import Pinia store
 * (bridge tách khỏi Vue để CombatScene/PhaserCanvas không kéo store). */
export interface KiemBarPlayerState {
  kiemTu?: KiemTuState
  realmId: string
}

/**
 * Đọc snapshot Kiếm bar HIỆN TẠI từ battle đang chạy. null = ẩn bar.
 * Mode xác định từ player.kiemTu.mode (canonical state, K1); the
 * battle-scoped provider snapshot supplies cursor/log (runtime, never
 * persisted).
 */
export function makeKiemBarReader(
  gameManager: GameManager,
  getPlayer: () => KiemBarPlayerState,
): KiemBarReader {
  return () => {
    const battle = gameManager.getTurnBattle()

    if (!battle || !isBattleInProgress(battle.state)) {
      return null
    }

    const player = getPlayer()
    const kiemTu = player.kiemTu

    if (!kiemTu) {
      return null
    }

    if (kiemTu.mode === 'hien') {
      // The participant's provider owns the live cursor/log — the
      // persisted preset is the fallback when no provider is attached
      // (e.g. mid-migration battles built before the hien wiring).
      const provider = battle.players[0]?.dynamicBasic
      const snapshot = isKiemPhoProviderHandle(provider) ? provider.snapshot() : null
      const preset = snapshot?.preset ?? kiemTu.preset
      const cursor = snapshot?.cursor ?? 0

      return {
        current: cursor,
        max: Math.max(1, preset.length),
        label: 'Kiếm Phổ',
        mode: 'hien',
        preset,
        cursor,
        nextOrb: preset.length > 0 ? preset[cursor % preset.length] : undefined,
        log: snapshot?.log ?? [],
      }
    }

    // ngu (Task 8) — bar = Kiem Y progress toward the next forge at the
    // CURRENT realm's forgeCost; label carries the live sword count.
    const realmIndex = getRealmIndex(player.realmId)

    return {
      current: kiemTu.kiemY,
      max: realmIndex >= 1 ? forgeCost(realmIndex) : 1,
      label: `Kiếm Ý · ${kiemTu.kiemDaoCount} kiếm`,
      mode: 'ngu',
      kiemDaoCount: kiemTu.kiemDaoCount,
      kiemDaoBase: kiemTu.kiemDaoBase,
    }
  }
}

export function registerKiemBarReader(registry: GateRegistry, reader: KiemBarReader): void {
  writeGate(registry, KIEM_BAR_READER_KEY, reader)
}

export function readKiemBar(registry: GateRegistry): KiemBarSnapshot | null {
  const reader = readOptionalGate(registry, KIEM_BAR_READER_KEY)

  if (!reader) {
    return null
  }

  return reader()
}

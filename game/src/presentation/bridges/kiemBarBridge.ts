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
import { MAX_THE } from '@/core/combat/CombatTypes'
import type { OrbId, KiemTuState } from '@/core/kiem-tu/KiemTuState'
import { isKiemPhoProviderHandle } from '@/core/kiem-tu/KiemPhoProvider'
import { forgeCost } from '@/core/kiem-tu/NguKiemDao'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { getPathWayDefinition, type CultivationPathId } from '@/core/player/CultivationPathKit'
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
  // The Tu Reimagined (T22) — Son Nhac Ho The external-ward layer: a
  // SEPARATE protection-only shield, never merged into the resource bar
  // or the native ward pool. Rendered on any path when the player
  // entity carries a pool (max = holder maxHp — shield fraction of HP).
  externalWard?: { current: number; max: number }
}

export type KiemBarReader = () => KiemBarSnapshot | null

export const KIEM_BAR_READER_KEY = 'kiemBarReader' as const

/** Phần state player mà reader cần — structural, không import Pinia store
 * (bridge tách khỏi Vue để CombatScene/PhaserCanvas không kéo store). */
export interface KiemBarPlayerState {
  kiemTu?: KiemTuState
  realmId: string
  // The Tu Reimagined (T22) — the path kit's usesTheResource flag
  // decides whether the bar shows The; no path-id checks in the HUD.
  cultivationPath?: CultivationPathId
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

    // TurnBattle participant shape — the human player's CombatEntity is
    // players[0].entity; the external-ward pool lives on the entity (T22).
    const battleEntity = battle.players[0]?.entity
    const externalWard = battleEntity?.externalWard
      ? { current: battleEntity.externalWard.amount, max: battleEntity.stats?.maxHp ?? 0 }
      : undefined

    if (!kiemTu) {
      // The Tu An (T22) — The proc-fuel pool, gated by the way flag so
      // the HUD stays data-driven (no path-id checks outside way data).
      if (player.cultivationPath && getPathWayDefinition(player.cultivationPath)?.usesTheResource) {
        return {
          current: battleEntity?.currentThe ?? 0,
          max: battleEntity?.maxThe ?? MAX_THE,
          label: 'Thế',
          externalWard,
        }
      }

      // No resource pool for this path — still surface a live shield.
      return externalWard ? { current: 0, max: 0, label: '', externalWard } : null
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
        externalWard,
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
      externalWard,
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

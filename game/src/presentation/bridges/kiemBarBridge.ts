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
import {
  type CultivationPathId,
  type PathWayId,
} from '@/core/player/CultivationPathKit'
import {
  getKiemTuPreset,
  hasStaticPathCapability,
} from '@/core/player/CultivationPathSystem'
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
  // P1 - the bar mode is selected by declared capabilities
  // ('the_tu.the_economy' / 'kiem_tu.kiem_pho' / 'kiem_tu.ngu_kiem_dao')
  // resolved from the persisted pair - no path-id checks, no slice-
  // presence inference in the HUD.
  cultivationPath?: CultivationPathId
  cultivationWay?: PathWayId
}

/**
 * Đọc snapshot Kiếm bar HIỆN TẠI từ battle đang chạy. null = ẩn bar.
 * Way xác định từ player.cultivationWay (M6 — the retired
 * kiemTu.mode discriminator); the battle-scoped provider snapshot
 * supplies cursor/log (runtime, never persisted).
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

    // The Tu An (T22) - the The proc-fuel pool bar, gated by the declared
    // capability (the way's owned discriminator; P1).
    if (hasStaticPathCapability(player, 'the_tu.the_economy')) {
      return {
        current: battleEntity?.currentThe ?? 0,
        max: battleEntity?.maxThe ?? MAX_THE,
        label: 'Thế',
        externalWard,
      }
    }

    if (kiemTu && hasStaticPathCapability(player, 'kiem_tu.kiem_pho')) {
      // The participant's provider owns the live cursor/log — the
      // persisted preset is the fallback when no provider is attached
      // (e.g. mid-migration battles built before the hien wiring). The
      // preset reaches the HUD through the canonical subpath read.
      const provider = battle.players[0]?.dynamicBasic
      const snapshot = isKiemPhoProviderHandle(provider) ? provider.snapshot() : null
      const preset = snapshot?.preset ?? getKiemTuPreset(player) ?? []
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

    if (kiemTu && hasStaticPathCapability(player, 'kiem_tu.ngu_kiem_dao')) {
      // ngu — bar = Kiem Y progress toward the next forge at the
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

    // No resource capability, or a corrupt pair missing its slice -
    // fail closed, ward only.
    return externalWard ? { current: 0, max: 0, label: '', externalWard } : null
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

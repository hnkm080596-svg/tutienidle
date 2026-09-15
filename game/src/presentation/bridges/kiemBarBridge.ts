// 9.4 — Kiếm bar HUD (Kiếm Thế / Kiếm Ý tạm route Kiếm Tu) hiện theo
// route, cập nhật MỖI FRAME qua CombatScene.update() (poll, KHÔNG emit
// event — CombatDefeatPanel/CombatVictoryPanel giữ nguyên).
//
// Kiến trúc: CombatScene (Phaser) CHỈ giao tiếp với core qua EventBus
// (xem PhaserCanvas.vue) — không cầm GameManager trực tiếp. Nên reader
// lấy battle + route tính toán được ĐĂNG KÝ từ PhaserCanvas (nơi đã có
// gameManager + player store) vào Phaser registry; CombatScene mỗi frame
// gọi reader qua registry key này (pattern y hệt 'eventBus' /
// 'lastBattlePositionsSnapshot').
//
// Reader trả null khi KHÔNG có battle / route không phải Kiếm Tu / battle
// chưa diễn ra → CombatScene ẩn Kiếm bar (updateKiem(0, 0, '')).

import { MAX_KIEM_THE, MAX_THE } from '@/core/combat/CombatTypes'
import { kiemYTempMaxFor } from '@/core/battle/KiemTuResourceSystem'
import { getKiemYPermanent } from '@/core/player/KiemYSystem'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import type { GameManager } from '@/core/game/GameManager'
import type { KiemTuRoute } from '@/core/player/Player'
import type { CultivationPathId } from '@/core/player/CultivationPathKit'
import {
  readOptionalGate,
  writeGate,
  type GateRegistry,
} from '@/presentation/gate/PresentationGate'

export interface KiemBarSnapshot {
  current: number
  max: number
  label: string

  // The Tu Reimagined (T22, review P1.2) — Sơn Nhạc Hộ Thể external ward:
  // a SEPARATE protection-only shield layer, never merged into the
  // resource bar or the native ward pool. Rendered on any path when the
  // player entity carries a pool (max = the holder's maxHp — shield
  // fraction of health).
  externalWard?: { current: number; max: number }
}

export type KiemBarReader = () => KiemBarSnapshot | null

export const KIEM_BAR_READER_KEY = 'kiemBarReader' as const

/** Phần state player mà reader cần — structural, không import Pinia store
 * (bridge tách khỏi Vue để CombatScene/PhaserCanvas không kéo store). */
export interface KiemBarPlayerState {
  kiemTuRoute?: KiemTuRoute
  bossKillCount: number
  // The Tu Reimagined (T22) — the path kit's usesTheResource flag decides
  // whether the bar shows Thế; no path-id checks in the HUD itself.
  cultivationPath?: CultivationPathId
}

/**
 * Đọc snapshot Kiếm bar HIỆN TẠI từ battle đang chạy. null = ẩn bar.
 * Route xác định từ player.kiemTuRoute (nguồn sự thật duy nhất theo
 * Final review fix Important #6); battle cung cấp pool trong trận.
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

    // TurnBattle participant shape — the human player's CombatEntity is
    // players[0].entity (Kiem Tu pools live on CombatEntity, M13).
    const battleEntity = battle.players[0]?.entity

    if (!battleEntity) {
      return null
    }

    const externalWard = battleEntity.externalWard
      ? { current: battleEntity.externalWard.amount, max: battleEntity.stats?.maxHp ?? 0 }
      : undefined

    const route = player.kiemTuRoute

    if (route === 'kiem_tran') {
      const current = battleEntity.currentKiemThe ?? 0

      return { current, max: MAX_KIEM_THE, label: 'Kiếm Thế', externalWard }
    }

    if (route === 'bat_kiem') {
      // bat_kiem — Kiếm Ý tạm = vĩnh viễn (đầu trận) + tích trong trận.
      const kiemYPermanent = getKiemYPermanent(player.bossKillCount)
      const current = (battleEntity.currentKiemYTemp ?? 0) + kiemYPermanent
      const max = kiemYTempMaxFor(kiemYPermanent)
      const tier = getKiemYTierForPermanent(kiemYPermanent)

      return { current, max, label: `Kiếm Ý T.${tier}`, externalWard }
    }

    // The Tu An (T22) — Thế proc-fuel pool, gated by the kit flag so the
    // HUD stays data-driven (no path-id checks outside the kit data).
    if (player.cultivationPath && CULTIVATION_PATH_KITS[player.cultivationPath].usesTheResource) {
      return {
        current: battleEntity.currentThe ?? 0,
        max: battleEntity.maxThe ?? MAX_THE,
        label: 'Thế',
        externalWard,
      }
    }

    // No resource pool for this path — still surface a live shield layer.
    return externalWard ? { current: 0, max: 0, label: '', externalWard } : null
  }
}

/** Tier = số Kiếm Ý vĩnh viễn / 10 (spec mục 3.1 — "+10 mỗi tầng"). */
function getKiemYTierForPermanent(kiemYPermanent: number): number {
  return Math.max(0, Math.floor(kiemYPermanent / 10))
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

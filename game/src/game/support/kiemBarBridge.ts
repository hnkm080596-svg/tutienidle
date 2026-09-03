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

import { MAX_KIEM_THE } from '@/core/combat/CombatTypes'
import { kiemYTempMaxFor } from '@/core/battle/KiemTuResourceSystem'
import { getKiemYPermanent } from '@/core/player/KiemYSystem'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import type { GameManager } from '@/core/game/GameManager'
import type { KiemTuRoute } from '@/core/player/Player'

export interface KiemBarSnapshot {
  current: number
  max: number
  label: string
}

export type KiemBarReader = () => KiemBarSnapshot | null

export const KIEM_BAR_READER_KEY = 'kiemBarReader'

/** Phần state player mà reader cần — structural, không import Pinia store
 * (bridge tách khỏi Vue để CombatScene/PhaserCanvas không kéo store). */
export interface KiemBarPlayerState {
  kiemTuRoute?: KiemTuRoute
  bossKillCount: number
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
    const battle = gameManager.getBattle()

    if (!battle || !isBattleInProgress(battle.state)) {
      return null
    }

    const player = getPlayer()
    const route = player.kiemTuRoute

    if (!route) {
      return null
    }

    if (route === 'kiem_tran') {
      const current = battle.player.currentKiemThe ?? 0

      return { current, max: MAX_KIEM_THE, label: 'Kiếm Thế' }
    }

    // bat_kiem — Kiếm Ý tạm = vĩnh viễn (đầu trận) + tích trong trận.
    const kiemYPermanent = getKiemYPermanent(player.bossKillCount)
    const current = (battle.player.currentKiemYTemp ?? 0) + kiemYPermanent
    const max = kiemYTempMaxFor(kiemYPermanent)
    const tier = getKiemYTierForPermanent(kiemYPermanent)

    return { current, max, label: `Kiếm Ý T.${tier}` }
  }
}

/** Tier = số Kiếm Ý vĩnh viễn / 10 (spec mục 3.1 — "+10 mỗi tầng"). */
function getKiemYTierForPermanent(kiemYPermanent: number): number {
  return Math.max(0, Math.floor(kiemYPermanent / 10))
}

export function registerKiemBarReader(registry: { set: (key: string, value: unknown) => void }, reader: KiemBarReader): void {
  registry.set(KIEM_BAR_READER_KEY, reader)
}

export function readKiemBar(registry: { get: (key: string) => unknown }): KiemBarSnapshot | null {
  const reader = registry.get(KIEM_BAR_READER_KEY) as KiemBarReader | undefined

  if (!reader) {
    return null
  }

  return reader()
}

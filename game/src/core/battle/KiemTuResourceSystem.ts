import type { CombatEntity } from '../combat/CombatEntity'
import {
  KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT,
  MAX_KIEM_THE,
  MAX_KIEM_Y_TEMP_CAP,
} from '../combat/CombatTypes'
import type { KiemTuRoute } from '../player/Player'

// Kiếm Thế / Kiếm Ý tạm (spec 2026-08-29-kiem-the-kiem-y) — runtime
// thuần của 2 pool CHIẾN ĐẤU route Kiếm Tu, pattern PhapTuBattle
// ResourceSystem (tick/gain riêng, KHÔNG đụng CombatSystem pipeline).
// Mọi hàm đọc field optional qua `?? 0` — CombatEntity.currentKiemThe/
// currentKiemYTemp là optional theo precedent currentHuyetPha.

/** +1% sát thương kiếm trận & on-hit mỗi 2 điểm Kiếm Thế (spec mục 2 — đầy 100 = +50%). */
export function kiemTheDamageBonusPercent(currentKiemThe: number): number {
  return currentKiemThe / 2
}

/** Cap kiếm ý tạm = nền vĩnh viễn (đầu trận) + 900 tạm (spec mục 3.2). */
export function kiemYTempMaxFor(kiemYPermanent: number): number {
  return kiemYPermanent + MAX_KIEM_Y_TEMP_CAP
}

/** Reset pool đầu trận (gọi từ BattleSystem.start/startTribulation cạnh initChannelState).
 * Route KT: Kiếm Thế về 0 (tích trong trận). Route BK: Kiếm Ý tạm khởi
 * đầu ĐÚNG bằng số kiếm ý vĩnh viễn (tầng boss × 10 — spec mục 3.2). */
export function initKiemTuBattleResources(
  player: CombatEntity,
  route: KiemTuRoute | undefined,
  kiemYPermanent: number,
): void {
  player.currentKiemThe = 0
  player.currentKiemYTemp = route === 'bat_kiem' ? kiemYPermanent : 0
}

/** Mỗi lần cast kiếm trận +số kiếm của trận, cap MAX_KIEM_THE (spec mục 2). */
export function gainKiemTheOnFormationCast(player: CombatEntity, swordCount: number): void {
  player.currentKiemThe = Math.min(
    MAX_KIEM_THE,
    (player.currentKiemThe ?? 0) + swordCount,
  )
}

/** Mỗi tick tụ lực Bạt Kiếm +1 Kiếm Ý tạm (spec mục 3.2 — tinh chỉnh playtest). */
export function gainKiemYTempOnChannelTick(player: CombatEntity, kiemYPermanent: number): void {
  player.currentKiemYTemp = Math.min(
    kiemYTempMaxFor(kiemYPermanent),
    (player.currentKiemYTemp ?? 0) + 1,
  )
}

/** +1 Kiếm Ý tạm mỗi 5% maxHP mất (KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP
 * PERCENT) — phần lẻ dưới ngưỡng KHÔNG gom (spec mục 3.2). */
export function gainKiemYTempOnDamageTaken(player: CombatEntity, maxHpPercentLost: number): void {
  const gain = Math.floor(maxHpPercentLost * 100 / KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT)
  if (gain <= 0) {
    return
  }
  // Không cap ở đây — cap xét trên tổng (vĩnh viễn + 900), caller có
  // kiemYPermanent để cap đúng; nếu không biết vĩnh viễn thì chỉ cap
  // phần tạm thuần (an toàn hơn mất progress).
  player.currentKiemYTemp = (player.currentKiemYTemp ?? 0) + gain
}

/** Tiêu hao Kiếm Ý: ăn TẠM TRƯỚC, vĩnh viễn BẤT KHẢ XÂM PHẠM (spec mục
 * 3.2 — "10 vĩnh viễn + 90 tạm, tốn 100 → mất 90 giữ 10"). Trả false
 * và KHÔNG trừ gì nếu tổng (tạm + vĩnh viễn) không đủ. */
export function consumeKiemYTempFirst(
  entity: CombatEntity,
  amount: number,
  kiemYPermanent: number,
): boolean {
  const temp = entity.currentKiemYTemp ?? 0
  if (temp + kiemYPermanent < amount) {
    return false
  }
  entity.currentKiemYTemp = Math.max(0, temp - amount)
  return true
}

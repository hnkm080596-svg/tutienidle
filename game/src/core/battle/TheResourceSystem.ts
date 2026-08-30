import type { CombatEntity } from '../combat/CombatEntity'
import { MAX_THE, THE_GAIN_PER_FINISHER, THE_GAIN_PER_LINK } from '../combat/CombatTypes'

// Thế Thuần hệ Pháp Tu (spec 2026-08-30-phap-tu-dao-sac §2.3) — runtime
// thuần của pool CHIẾN ĐẤU, pattern KiemTuResourceSystem (tick/gain riêng,
// KHÔNG đụng CombatSystem pipeline). Mọi hàm đọc field optional qua
// `?? 0` — CombatEntity.currentThe là optional theo precedent
// currentKiemThe: chỉ Pháp Tu đã chốt Thuần mới có ý nghĩa, mọi
// fixture/factory của path khác không cần touch.

/** +10 mỗi link chuỗi cast hoàn tất (+20 với finisher E), cap MAX_THE.
 * Không decay theo thời gian — Thế tích xuyên kill, chỉ tiêu hao qua ult. */
export function gainTheOnChainLink(player: CombatEntity, isFinisher: boolean): void {
  player.currentThe = Math.min(
    MAX_THE,
    (player.currentThe ?? 0) + (isFinisher ? THE_GAIN_PER_FINISHER : THE_GAIN_PER_LINK),
  )
}

/** Ult mở khi Thế đầy (MAX_THE); bắn xong reset về 0 (spec §2.3 —
 * "Thế tích xuyên kill, đầy → Ultimate, dùng xong tích lại"). Trả
 * false và KHÔNG trừ gì nếu chưa đầy. */
export function consumeTheForUlt(player: CombatEntity): boolean {
  if ((player.currentThe ?? 0) < MAX_THE) {
    return false
  }

  player.currentThe = 0
  return true
}

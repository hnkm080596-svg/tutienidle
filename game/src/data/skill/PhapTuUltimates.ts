import type { ElementType } from '../../core/element/ElementType'

// Pháp Tu Thuần Hệ (spec 2026-09-03 §3, Task 10) — data id ult per hành,
// tách KHỎI UltimateSystem.ts (engine real-time đã chết từ Slice 6
// cutover, chỉ còn là shell; data này sống cho Node Tree unlock +
// content tương lai). Re-export compat từ UltimateSystem.ts giữ cho
// consumer cũ chưa migrate.
export const PHAP_TU_ULTIMATE_IDS = {
  fire: 'tat_phuong_giang_the',
  water: 'bat_thu_can_quet',
  wood: 'kien_moc_thong_thien',
  metal: 'kim_phat_thu_sat',
  earth: 'hau_tho_thanh_luy',
} as const

export type PhapTuUltimateElement = keyof typeof PHAP_TU_ULTIMATE_IDS

/** E-6 (plan 2026-09-03-thuan-he) — targeting profile per hành:
 * 'all' = mọi địch còn sống (diện rộng — 4 ult), 'single_boss_priority'
 * = ĐÚNG 1 target, boss trước, không boss → HP HIỆN TẠI cao nhất,
 * KHÔNG splash overkill (Kim Phạt là "hình phạt" đơn — khác KKTM). */
export type PhapTuUltimateProfile = 'all' | 'single_boss_priority'

export const PHAP_TU_ULTIMATE_PROFILES: Record<ElementType, PhapTuUltimateProfile> = {
  fire: 'all',
  water: 'all',
  wood: 'all',
  metal: 'single_boss_priority',
  earth: 'all',
}

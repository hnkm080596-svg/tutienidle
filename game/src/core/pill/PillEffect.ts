import type { Buff } from '../buff/Buff'
import type { StatType } from '../stats/StatTypes'

export type PillEffectType =
  | 'heal'
  | 'cultivation'
  | 'buff'
  | 'permanent_stat'
  // 4 effect MVP nghề Đan (2026-08-24, resource-professions-rework §5.1):
  | 'random_main_stat'
  | 'regen'
  | 'skill_insight'

export interface PillEffect {
  type: PillEffectType

  // Với 'permanent_stat'/'skill_insight': lượng flat cộng một lần.
  value?: number

  // Buff đầy đủ, dùng khi type === 'buff'. Pill không có registry
  // buff riêng để tra theo id (BuffSystem.apply() vẫn nhận thẳng
  // object Buff), nên effect mang theo definition luôn.
  buff?: Buff

  // Dạng khi type === 'permanent_stat'.
  stat?: StatType

  // ---- 'regen' (plan §5.4) — hồi HP/MP theo giây, thời gian thực ----
  hpPerSecond?: number

  mpPerSecond?: number

  durationSeconds?: number

  /** Nhóm stack — cùng nhóm refresh deadline, không cộng dồn. */
  effectGroup?: string

  // ---- 'cultivation' theo % yêu cầu tầng hiện tại (plan §5.5) ----
  cultivationPercent?: number
}

import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { MainStatKey } from '../stats/StatTypes'

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
  // buff riêng để tra theo id — effect mang theo definition luôn
  // (BuffDefinition, template/authored data — PillTarget.applyBuff()
  // resolves it into a runtime Buff via BuffSystem.apply(), giống
  // GameManager.applyPersistentBuff()).
  buff?: BuffDefinition

  // For 'permanent_stat'. Writes land in baseStats under the shared
  // main-stat cap, so only MAIN_STAT_KEYS are meaningful here - the
  // runtime also refuses non-main entries as authored drift.
  stat?: MainStatKey

  // ---- 'regen' (plan §5.4) — hồi HP/MP theo giây, thời gian thực ----
  hpPerSecond?: number

  mpPerSecond?: number

  durationSeconds?: number

  /** Nhóm stack — cùng nhóm refresh deadline, không cộng dồn. */
  effectGroup?: string

  /** Uống lại cộng tiếp thời lượng thay vì chỉ refresh deadline. */
  stackable?: boolean

  // ---- 'cultivation' theo % yêu cầu tầng hiện tại (plan §5.5) ----
  cultivationPercent?: number
}

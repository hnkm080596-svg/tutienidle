import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { MainStatKey } from '../stats/StatTypes'

export type PillEffectType =
  | 'heal'
  | 'cultivation'
  | 'buff'
  | 'permanent_stat'
  // 4 effect MVP nghe Dan (2026-08-24, resource-professions-rework sec5.1):
  | 'random_main_stat'
  | 'regen'
  | 'skill_insight'

export interface PillEffect {
  type: PillEffectType

  // Voi 'permanent_stat'/'skill_insight': luong flat cong mot lan.
  value?: number

  // Buff day du, dung khi type === 'buff'. Pill khong co registry
  // buff rieng de tra theo id - effect mang theo definition luon
  // (BuffDefinition, template/authored data - PillTarget.applyBuff()
  // resolves it into a runtime Buff via BuffSystem.apply(), giong
  // GameManager.applyPersistentBuff()).
  buff?: BuffDefinition

  // For 'permanent_stat'. Writes land in baseStats under the shared
  // main-stat cap, so only MAIN_STAT_KEYS are meaningful here - the
  // runtime also refuses non-main entries as authored drift.
  stat?: MainStatKey

  // ---- 'regen' (plan sec5.4) - hoi HP/MP theo giay, thoi gian thuc ----
  hpPerSecond?: number

  mpPerSecond?: number

  durationSeconds?: number

  /** Nhom stack - cung nhom refresh deadline, khong cong don. */
  effectGroup?: string

  /** Uong lai cong tiep thoi luong thay vi chi refresh deadline. */
  stackable?: boolean

  // ---- 'cultivation' theo % yeu cau tang hien tai (plan sec5.5) ----
  cultivationPercent?: number
}

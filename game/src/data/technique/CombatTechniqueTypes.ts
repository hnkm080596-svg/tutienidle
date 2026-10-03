import type { StatType } from '@/core/stats/StatTypes'

/**
 * "Database" cau hinh Type cho Tam Phap Chien Dau - Type quyet dinh
 * pool stat ma tam phap CO THE nhan, giup he thong de mo rong ma
 * khong can hard-code tung quyen (dung yeu cau). Technique tu khai
 * `modifiers` that (giong Equipment khong random-roll) - config nay
 * chi mang tinh to chuc noi dung/hien thi UI ("Type: Phong Ngu"),
 * KHONG rang buoc runtime cung nhac.
 */
export interface CombatTechniqueTypeConfig {
  id: string

  name: string

  mainStats: [StatType, StatType]

  substatPool: StatType[]
}

export const COMBAT_TECHNIQUE_TYPES: CombatTechniqueTypeConfig[] = [
  {
    id: 'crit',

    name: 'Bạo Kích',

    mainStats: ['criticalRate', 'criticalDamage'],

    substatPool: ['might', 'speed', 'criticalAvoidance'],
  },

  {
    id: 'def',

    name: 'Phòng Ngự',

    mainStats: ['defense', 'maxHp'],

    substatPool: ['blockChance', 'blockEffectiveness', 'enduranceThreshold', 'endurancePercent'],
  },

  {
    id: 'speed',

    name: 'Tốc Chiến',

    mainStats: ['speed', 'accuracyRating'],

    substatPool: ['might'],
  },

  {
    id: 'sustain',

    name: 'Trường Chiến',

    mainStats: ['leechPercent', 'hpRegenPerTurn'],

    substatPool: ['maxHp', 'wardMax', 'wardRegenPerTurn'],
  },
]

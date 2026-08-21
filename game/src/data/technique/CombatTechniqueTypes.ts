import type { StatType } from '@/core/stats/StatTypes'

/**
 * "Database" cấu hình Type cho Tâm Pháp Chiến Đấu — Type quyết định
 * pool stat mà tâm pháp CÓ THỂ nhận, giúp hệ thống dễ mở rộng mà
 * không cần hard-code từng quyển (đúng yêu cầu). Technique tự khai
 * `modifiers` thật (giống Equipment không random-roll) — config này
 * chỉ mang tính tổ chức nội dung/hiển thị UI ("Type: Phòng Ngự"),
 * KHÔNG ràng buộc runtime cứng nhắc.
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

    substatPool: ['attack', 'attackSpeed', 'criticalAvoidance'],
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

    mainStats: ['attackSpeed', 'accuracyRating'],

    substatPool: ['attack', 'movementSpeed', 'cooldownReduction'],
  },

  {
    id: 'sustain',

    name: 'Trường Chiến',

    mainStats: ['leechPercent', 'hpRegenPerSecond'],

    substatPool: ['maxHp', 'wardMax', 'wardRegenPerSecond'],
  },
]

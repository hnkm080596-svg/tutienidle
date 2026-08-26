import type { Formation } from '@/core/formation/Formation'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Trận (2026-08-24, resource-professions-rework §7) — modifier-item hai
// modifier tĩnh tấn công, socket mọi slot (mỗi slot 1 Trận cạnh 1 Phù).
// MVP bỏ trigger/stack — FormationSystem legacy không còn chạy.
function modifier(
  id: string,
  sourceId: string,
  stat: StatModifier['stat'],
  flat: number,
): StatModifier {
  return { id, sourceId, sourceType: 'formation', stat, flat }
}

const REALM_IDS = ['mortal', 'qi_refining', 'foundation_establishment'] as const
const REALM_NAMES: Record<(typeof REALM_IDS)[number], string> = {
  mortal: 'Phàm Nhân',
  qi_refining: 'Luyện Khí',
  foundation_establishment: 'Trúc Cơ',
}
const RARITY_NAMES = { common: 'Hạ Phẩm', uncommon: 'Trung Phẩm', rare: 'Thượng Phẩm' } as const
const RARITY_SCALE = { common: 1, uncommon: 2.5, rare: 6 } as const
const REALM_SCALE = { mortal: 1, qi_refining: 4, foundation_establishment: 12 } as const
const ALL_SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'necklace'] as const

export const formations: Formation[] = REALM_IDS.flatMap((realmId) =>
  (['common', 'uncommon', 'rare'] as const).map((rarity) => {
    const scale = RARITY_SCALE[rarity] * REALM_SCALE[realmId]
    const id = `tran_${realmId}_${rarity}`
    const name = `${RARITY_NAMES[rarity]} Trận ${REALM_NAMES[realmId]}`

    return {
      id,
      name,
      description: 'Trận hai modifier tấn công, gắn trên slot trang bị cùng cảnh giới.',
      realmId,
      grade:
        realmId === 'mortal' ? 'cuu_pham' : realmId === 'qi_refining' ? 'bat_pham' : 'that_pham',
      allowedSlots: ALL_SLOTS,
      modifiers: [
        modifier(`${id}_attack`, id, 'attack', Math.round(6 * scale)),
        modifier(`${id}_crit`, id, 'criticalRate', Number((0.02 * scale).toFixed(4))),
      ],
    }
  }),
)

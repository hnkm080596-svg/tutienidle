import type { Talisman } from '@/core/talisman/Talisman'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Phù (2026-08-24, resource-professions-rework §7) — modifier-item hai
// modifier tĩnh phòng thủ/tiện ích, socket theo slot. Product scope 3
// realm × 3 rarity; allowedSlots: mọi slot trừ weapon (weapon dành Trận
// tấn công mạnh nhất — vẫn socket Phù được nếu data mở, mặc định đóng).
function modifier(
  id: string,
  sourceId: string,
  stat: StatModifier['stat'],
  flat: number,
): StatModifier {
  return { id, sourceId, sourceType: 'talisman', stat, flat }
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
const SLOTS = ['helmet', 'armor', 'boots', 'ring', 'necklace'] as const

export const talismans: Talisman[] = REALM_IDS.flatMap((realmId) =>
  (['common', 'uncommon', 'rare'] as const).flatMap((rarity) => {
    const scale = RARITY_SCALE[rarity] * REALM_SCALE[realmId]
    const id = `phu_${realmId}_${rarity}`
    const name = `${RARITY_NAMES[rarity]} Phù ${REALM_NAMES[realmId]}`

    return [
      {
        id,
        name,
        description: 'Phù hai modifier phòng thủ/tiện ích, gắn trên slot trang bị cùng cảnh giới.',
        realmId,
        grade:
          realmId === 'mortal' ? 'cuu_pham' : realmId === 'qi_refining' ? 'bat_pham' : 'that_pham',
        allowedSlots: SLOTS,
        modifiers: [
          modifier(`${id}_max_hp`, id, 'maxHp', Math.round(60 * scale)),
          modifier(`${id}_hp_regen`, id, 'hpRegenPerSecond', Number((0.8 * scale).toFixed(2))),
        ],
      },
    ]
  }),
)

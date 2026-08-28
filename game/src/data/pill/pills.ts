import type { Pill } from '@/core/pill/Pill'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import { getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import type { ItemGrade } from '@/core/item/ItemGrade'
import { PILL_FAMILIES, type PillFamilyDefinition } from './PillFamilies'

const TIER_ITEM_GRADES: readonly ItemGrade[] = [
  'hoang', 'hoang', 'huyen', 'huyen', 'dia', 'dia', 'thien', 'thien', 'tien',
]

function buildEffects(family: PillFamilyDefinition, tierIndex: number): Pill['effects'] {
  const scale = Math.pow(1.7, tierIndex)

  switch (family.effect.kind) {
    case 'cultivation':
      return [{ type: 'cultivation', cultivationPercent: 0.02 + tierIndex * 0.005 }]
    case 'hp_regen':
      return [{
        type: 'regen',
        hpPerSecond: Math.round(4 * scale),
        durationSeconds: 60 + tierIndex * 15,
        effectGroup: family.id,
        stackable: true,
      }]
    case 'mp_regen':
      return [{
        type: 'regen',
        mpPerSecond: Math.round(2 * scale),
        durationSeconds: 60 + tierIndex * 15,
        effectGroup: family.id,
        stackable: true,
      }]
    case 'permanent_stat':
      return [{
        type: 'permanent_stat',
        stat: family.effect.stat,
        value: Math.max(1, Math.round(scale / 2)),
      }]
  }
}

/**
 * Chỉ có tám LOẠI đan. Mỗi loại có chín phẩm runtime để PillBag giữ riêng
 * từng phẩm; phẩm quyết định sức mạnh và cảnh giới được phép sử dụng.
 */
export function buildTieredPills(): Pill[] {
  return REALM_TIERS.flatMap((realmId, tierIndex) => PILL_FAMILIES.map((family) => ({
    id: `${family.id}_${realmId}`,
    name: family.name,
    description: `${family.name} phẩm dành cho cảnh giới tương ứng.`,
    type: family.effect.kind === 'cultivation'
      ? 'cultivation'
      : family.effect.kind === 'permanent_stat' ? 'permanent' : 'healing',
    grade: TIER_ITEM_GRADES[tierIndex]!,
    realmId,
    professionGrade: getProfessionGradeForRealm(realmId),
    icon: `/assets/pills/${family.id}.png`,
    effects: buildEffects(family, tierIndex),
  })))
}

export const pills: Pill[] = buildTieredPills()

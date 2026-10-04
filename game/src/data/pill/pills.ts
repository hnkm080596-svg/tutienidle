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
 * Chi co tam LOAI dan. Moi loai co chin pham runtime de PillBag giu rieng
 * tung pham; pham quyet dinh suc manh va canh gioi duoc phep su dung.
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
    // M10 (ARCH-008) - retired families keep their generated pills so old
    // saves' bag entries resolve, but carry the retirement marker.
    ...(family.retired === true ? { retired: true } : {}),
  })))
}

// Dan dac biet (spec dot-pha-loi-kiep sec4.1b) - 2 dan cua gate Truc
// Co, type 'material' KHONG uong: Thong Mach Dan tieu qua
// meridian chapter (core/realm/body/MeridianChapter.ts), Truc Co Dan la vat chung bac
// Dia/Thien (CO trong tui luc bam dot pha, khong tieu).
const SPECIAL_PILLS: Pill[] = [
  {
    id: 'thong_mach_dan',
    name: 'Thông Mạch Đan',
    description: 'Đan dược khai thông kinh mạch — tiêu qua Bát Mạch, không uống trực tiếp.',
    type: 'material',
    grade: 'huyen',
    realmId: 'qi_refining',
    professionGrade: getProfessionGradeForRealm('qi_refining'),
    // No dedicated art yet - shares the Khai Linh pill orb until the
    // thong_mach_dan illustration lands (previously pointed at a missing
    // file and rendered a broken-image glyph in the Mach cost rows).
    icon: '/assets/pills/khai_linh_dan.png',
    effects: [],
  },
  {
    id: 'truc_co_dan',
    name: 'Trúc Cơ Đan',
    description: 'Đan dược vững căn cơ — giữ bên mình khi đột phá, không uống trực tiếp.',
    type: 'material',
    grade: 'huyen',
    realmId: 'qi_refining',
    professionGrade: getProfessionGradeForRealm('qi_refining'),
    // No dedicated art yet - shares the To Cot pill orb (same missing-file
    // defect class as thong_mach_dan).
    icon: '/assets/pills/to_cot_dan.png',
    effects: [],
    // M-F-CEILING - held input of the Truc Co breakthrough gate; tagged
    // so release policy gates its acquisition routes.
    breakthroughRealmId: 'foundation_establishment',
  },
]

export const pills: Pill[] = [...buildTieredPills(), ...SPECIAL_PILLS]

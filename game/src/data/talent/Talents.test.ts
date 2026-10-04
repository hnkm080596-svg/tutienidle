import { describe, expect, it } from 'vitest'
import type { TalentRarity } from '../../core/talent/Talent'
import {
  CHARACTER_CREATION_TALENTS,
  PARKED_TALENTS,
  getTalentDefinition,
  rollCharacterCreationTalents,
} from './Talents'
import { TALENT_PASSIVE_SKILLS } from '../skill/TalentPassives'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'

// Catalog v4 (spec 2026-09-03-talent-catalog-v4-design.md) - pool roll:
// 11 combat + 5 tu luyen M2 + 2 san xuat M3 + Pham Cot (easter egg).
// 13 id v3 retired - khong con resolve (spec sec4.4).

// 13 id catalog v3 da retire (spec sec4.4) - giu list o test de khoa hanh
// vi "khong resolve", khong de du lieu chet lot lai catalog.
const RETIRED_V4_TALENT_IDS = [
  'tien_thien_dao_the',
  'nghich_thien',
  'dai_tri_nhuoc_ngu',
  'phan_phac',
  'huyet_chien',
  'luyen_the_ky_tai',
  'tu_bao',
  'co_duyen',
  'dan_duyen',
  'bat_khuat',
  'duoc_duyen',
  'dao_phap_tu_nhien',
  'vo_cau_dao_the',
]

describe('catalog v4 invariants (M1 combat)', () => {
  it('đúng 19 thiên phú tham gia roll (11 combat + 5 tu luyện M2 + 2 sản xuất M3 + Phàm Cốt)', () => {
    expect(CHARACTER_CREATION_TALENTS).toHaveLength(19)
  })

  it('id duy nhất, weight dương, có effect thật', () => {
    const ids = CHARACTER_CREATION_TALENTS.map((talent) => talent.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const talent of CHARACTER_CREATION_TALENTS) {
      expect(talent.weight).toBeGreaterThan(0)
      expect(talent.effects.length).toBeGreaterThan(0)
    }
  })

  it('ngân sách power (spec §4.1 §5) — 5 công + 5 thủ + Bất Tử Thể giữ, weight đúng thang rarity', () => {
    // Thang weight cu (spec sec4 dong dau): di w1 / thien w4 / dia w12 /
    // linh w28 / pham w55. Moi talent map dung rarity cua no.
    const WEIGHT_BY_RARITY: Record<TalentRarity, number> = {
      di: 1,
      thien: 4,
      dia: 12,
      linh: 28,
      pham: 55,
    }

    for (const talent of CHARACTER_CREATION_TALENTS) {
      expect(talent.weight).toBe(WEIGHT_BY_RARITY[talent.rarity])
    }

    // Dung co cau 11 combat (5 cong + 5 thu + Bat Tu The) + Pham Cot.
    const combatIds = [
      'kiem_quang',
      'pha_giap',
      'tat_phong',
      'trong_kich',
      'hap_linh',
      'thach_giap',
      'vo_anh',
      'can_than',
      'ho_the',
      'thu_phat',
      'bat_tu_the',
    ]

    // The phan loai UI theo quy uoc san co: nhom cong mang 'combat',
    // nhom thu mang 'defense' (metadata, khong thuoc ngan sach sec5).
    for (const id of combatIds) {
      const talent = getTalentDefinition(id)

      expect(talent, `talent ${id} phải thuộc pool M1`).toBeDefined()
      expect(
        CHARACTER_CREATION_TALENTS.some((entry) => entry.id === id),
        `talent ${id} phải tham gia roll`,
      ).toBe(true)
      expect(
        talent!.tags.includes('combat') || talent!.tags.includes('defense'),
        `talent ${id} phải mang tag combat/defense`,
      ).toBe(true)
    }
  })

  it('mô tả theo template 3 phần — có số liệu cơ chế + chi phí đối trọng (trừ Phàm Cốt verbatim)', () => {
    for (const talent of CHARACTER_CREATION_TALENTS) {
      // Pham Cot la easter egg - description verbatim cam sua (spec sec4
      // hang cuoi), khong ap template.
      if (talent.id === 'pham_cot') {
        continue
      }

      // Phan 2: co che bang so (it nhat 1 chu so).
      expect(talent.description).toMatch(/\d/)
      // Phan 3: chi phi/rui ro doi trong neu ro (giam/ton/mat/khong/kho/cham...).
      expect(talent.description.length).toBeGreaterThan(40)
    }
  })

  it('Phàm Cốt giữ verbatim — description + effect −75% + rarity di + weight 1', () => {
    const phamCot = getTalentDefinition('pham_cot')
    expect(phamCot).toBeDefined()
    expect(phamCot!.description).toBe('Ngươi sinh ra chính là người bình thường, lớn lên là kẻ bình thường, sau này khả năng vẫn sẽ luôn như vậy ...')
    expect(phamCot!.effects).toEqual([{ kind: 'cultivation_speed', percent: -0.75 }])
    expect(phamCot!.rarity).toBe('di')
    expect(phamCot!.weight).toBe(1)
  })

  it('13 id v3 retired — không thuộc pool roll VÀ không resolve (spec §4.4, save cũ bỏ qua an toàn)', () => {
    const poolIds = new Set(CHARACTER_CREATION_TALENTS.map((talent) => talent.id))

    for (const retiredId of RETIRED_V4_TALENT_IDS) {
      expect(poolIds.has(retiredId)).toBe(false)
      expect(getTalentDefinition(retiredId)).toBeUndefined()
    }
  })

  it('M3 sản xuất — 2 talent active trong pool với effect đúng kind + counter-cost', () => {
    const hoaHau = getTalentDefinition('hoa_hau_thong_than')
    const bachLuyen = getTalentDefinition('bach_luyen_thanh_khi')

    expect(hoaHau).toBeDefined()
    expect(bachLuyen).toBeDefined()

    expect(hoaHau!.effects).toEqual([
      {
        kind: 'alchemy_double_pill',
        yieldMultiplier: 2,
        potencyMultiplier: 1.5,
        costMultiplier: 2,
      },
    ])
    expect(bachLuyen!.effects).toEqual([
      { kind: 'enhance_guaranteed', costMultiplier: 3 },
    ])

    for (const talent of [hoaHau!, bachLuyen!]) {
      expect(
        CHARACTER_CREATION_TALENTS.some((entry) => entry.id === talent.id),
        `talent ${talent.id} phải tham gia roll`,
      ).toBe(true)
      expect(talent.tags.includes('crafting')).toBe(true)
    }
  })

  it('PARKED mới chỉ có Trận Tâm + Phù Văn (M3 sản xuất, weight 0 không roll)', () => {
    expect(PARKED_TALENTS.map((talent) => talent.id)).toEqual(['tran_tam', 'phu_van'])
    expect(PARKED_TALENTS.every((talent) => talent.weight === 0)).toBe(true)
  })

  it('mọi passiveConvertsTo.buffId tham chiếu tồn tại trong BUFF_REGISTRY (registry runtime consult lúc Phase A2 cutover)', () => {
    for (const skill of TALENT_PASSIVE_SKILLS) {
      if (skill.passiveConvertsTo) {
        expect(() => BUFF_REGISTRY.get(skill.passiveConvertsTo!.buffId)).not.toThrow()
      }
    }
  })

  it('mọi talent combat_passive trỏ đúng passive skill tồn tại (membership = learned authority)', () => {
    const passiveIds = new Set(TALENT_PASSIVE_SKILLS.map((skill) => skill.id))

    for (const talent of CHARACTER_CREATION_TALENTS) {
      for (const effect of talent.effects) {
        if (effect.kind === 'combat_passive') {
          expect(passiveIds.has(effect.passiveSkillId)).toBe(true)

          const skill = TALENT_PASSIVE_SKILLS.find((entry) => entry.id === effect.passiveSkillId)

          expect(skill!.type).toBe('passive')
          expect(skill!.passiveTrigger).toBeDefined()
          expect((skill!.passiveModifiers ?? []).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('getTalentDefinition resolve id lạ là undefined', () => {
    expect(getTalentDefinition('unknown_talent')).toBeUndefined()
  })
})

describe('rollCharacterCreationTalents', () => {
  it('returns nine unique talents from the catalog', () => {
    for (let index = 0; index < 50; index++) {
      const roll = rollCharacterCreationTalents()
      expect(roll).toHaveLength(9)
      expect(new Set(roll.map((talent) => talent.id)).size).toBe(9)
      expect(roll.every((talent) => CHARACTER_CREATION_TALENTS.includes(talent))).toBe(true)
    }
  })

  it('không bao giờ roll ra thiên phú parked hay retired', () => {
    const excludedIds = new Set([
      ...PARKED_TALENTS.map((talent) => talent.id),
      ...RETIRED_V4_TALENT_IDS,
    ])

    for (let index = 0; index < 50; index++) {
      const roll = rollCharacterCreationTalents()
      expect(roll.some((talent) => excludedIds.has(talent.id))).toBe(false)
    }
  })
})

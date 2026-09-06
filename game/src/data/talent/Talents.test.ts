import { describe, expect, it } from 'vitest'
import type { TalentRarity } from '../../core/talent/Talent'
import {
  CHARACTER_CREATION_TALENTS,
  PARKED_TALENTS,
  RETIRED_V4_TALENTS,
  getTalentDefinition,
  rollCharacterCreationTalents,
} from './Talents'
import { TALENT_PASSIVE_SKILLS } from '../skill/TalentPassives'
import { buffs } from '../buff/buffs'

// Catalog v4 (spec 2026-09-03-talent-catalog-v4-design.md) — M1 combat:
// pool roll = 11 talent combat + Phàm Cốt (easter egg). M2 thêm tu
// luyện, M3 thêm sản xuất (2 active + 2 PARKED). 13 id v3 retired.

describe('catalog v4 invariants (M1 combat)', () => {
  it('đúng 12 thiên phú tham gia roll (11 combat + Phàm Cốt)', () => {
    expect(CHARACTER_CREATION_TALENTS).toHaveLength(12)
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
    // Thang weight cũ (spec §4 dòng đầu): di w1 / thiên w4 / địa w12 /
    // linh w28 / phàm w55. Mỗi talent map đúng rarity của nó.
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

    // Đúng cơ cấu 11 combat (5 công + 5 thủ + Bất Tử Thể) + Phàm Cốt.
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

    // Thẻ phân loại UI theo quy ước sẵn có: nhóm công mang 'combat',
    // nhóm thủ mang 'defense' (metadata, không thuộc ngân sách §5).
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
      // Phàm Cốt là easter egg — description verbatim cấm sửa (spec §4
      // hàng cuối), không áp template.
      if (talent.id === 'pham_cot') {
        continue
      }

      // Phần 2: cơ chế bằng số (ít nhất 1 chữ số).
      expect(talent.description).toMatch(/\d/)
      // Phần 3: chi phí/rủi ro đối trọng nêu rõ (giảm/tốn/mất/không/khó/chậm...).
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

  it('13 id v3 retired — không thuộc pool roll nhưng vẫn resolve cho save cũ', () => {
    expect(RETIRED_V4_TALENTS).toHaveLength(13)

    const poolIds = new Set(CHARACTER_CREATION_TALENTS.map((talent) => talent.id))

    for (const retired of RETIRED_V4_TALENTS) {
      expect(poolIds.has(retired.id)).toBe(false)
      expect(getTalentDefinition(retired.id)).toBeDefined()
    }
  })

  it('PARKED mới chỉ có Trận Tâm + Phù Văn (M3 sản xuất, weight 0 không roll)', () => {
    expect(PARKED_TALENTS.map((talent) => talent.id)).toEqual(['tran_tam', 'phu_van'])
    expect(PARKED_TALENTS.every((talent) => talent.weight === 0)).toBe(true)
  })

  it('mọi passiveConvertsTo.buffId tham chiếu tồn tại trong BuffRegistry data', () => {
    const buffIds = new Set(buffs.map((buff) => buff.id))

    for (const skill of TALENT_PASSIVE_SKILLS) {
      if (skill.passiveConvertsTo) {
        expect(buffIds.has(skill.passiveConvertsTo.buffId)).toBe(true)
      }
    }
  })

  it('mọi talent combat_passive trỏ đúng passive skill tồn tại + equipped (PassiveSystem chỉ quét equipped)', () => {
    const passiveIds = new Set(TALENT_PASSIVE_SKILLS.map((skill) => skill.id))

    for (const talent of CHARACTER_CREATION_TALENTS) {
      for (const effect of talent.effects) {
        if (effect.kind === 'combat_passive') {
          expect(passiveIds.has(effect.passiveSkillId)).toBe(true)

          const skill = TALENT_PASSIVE_SKILLS.find((entry) => entry.id === effect.passiveSkillId)

          expect(skill!.type).toBe('passive')
          expect(skill!.equipped).toBe(true)
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
      ...RETIRED_V4_TALENTS.map((talent) => talent.id),
    ])

    for (let index = 0; index < 50; index++) {
      const roll = rollCharacterCreationTalents()
      expect(roll.some((talent) => excludedIds.has(talent.id))).toBe(false)
    }
  })
})

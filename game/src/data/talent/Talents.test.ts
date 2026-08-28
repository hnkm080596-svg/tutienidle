import { describe, expect, it } from 'vitest'
import {
  CHARACTER_CREATION_TALENTS,
  PARKED_TALENTS,
  getTalentDefinition,
  rollCharacterCreationTalents,
} from './Talents'

describe('catalog v3 invariants', () => {
  it('đúng 12 thiên phú tham gia roll', () => {
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

  it('không id trùng giữa catalog và PARKED', () => {
    const active = new Set(CHARACTER_CREATION_TALENTS.map((talent) => talent.id))
    for (const parked of PARKED_TALENTS) {
      expect(active.has(parked.id)).toBe(false)
    }
  })

  it('Phàm Cốt tồn tại với description verbatim và −75% tu luyện', () => {
    const phamCot = getTalentDefinition('pham_cot')
    expect(phamCot).toBeDefined()
    expect(phamCot!.description).toBe('Ngươi sinh ra chính là người bình thường, lớn lên là kẻ bình thường, sau này khả năng vẫn sẽ luôn như vậy ...')
    expect(phamCot!.effects).toEqual([{ kind: 'cultivation_speed', percent: -0.75 }])
    expect(phamCot!.rarity).toBe('di')
  })

  it('getTalentDefinition resolve cả thiên phú parked cho save cũ', () => {
    expect(getTalentDefinition('vo_cau_dao_the')).toBeDefined()
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

  it('không bao giờ roll ra thiên phú parked', () => {
    const parkedIds = new Set(PARKED_TALENTS.map((talent) => talent.id))
    for (let index = 0; index < 50; index++) {
      const roll = rollCharacterCreationTalents()
      expect(roll.some((talent) => parkedIds.has(talent.id))).toBe(false)
    }
  })
})

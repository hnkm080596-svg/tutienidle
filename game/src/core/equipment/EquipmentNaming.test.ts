import { describe, expect, it } from 'vitest'
import { composeEquipmentNameSegments, composeEquipmentDisplayName } from './EquipmentNaming'
import { makeInstance } from './EquipmentInstance.fixture'
import type { Equipment } from './Equipment'
import { ZoneRegistry } from '../stage/ZoneRegistry'

// Naming rework (2026-09-14 user ruling + item-info-card spec):
// segment shape [Chat, name] - text structure ONLY. The display color
// moved to the tooltip/toast payload (nameColorVar), and the Pham
// label renders as the tooltip "Canh gioi" line, not a name segment.

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Thanh Vân Kiếm',
  slot: 'weapon',
  grade: 1,
  mainStats: [{ stat: 'attack', min: 8, max: 12 }],
  maxEnhanceLevel: 10,
}

function setup() {
  return { zoneRegistry: new ZoneRegistry() }
}

describe('composeEquipmentNameSegments', () => {
  it('cuu_pham (lowest grade) + hoang (lowest quality) - 2-segment {text} shape [short Chat, name]', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'cuu_pham', quality: 'hoang' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments).toEqual([
      { text: 'Hoàng' },
      { text: '- Thanh Vân Kiếm' },
    ])
  })

  it('tien_pham (highest grade, rank 10) + tien (highest quality) - same {text} shape, unchanged', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'tien_pham', quality: 'tien' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments).toEqual([
      { text: 'Tiên' },
      { text: '- Thanh Vân Kiếm' },
    ])
  })

  it('mismatched tiers (high grade, low quality) - Chat follows quality, name follows template', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'ngu_pham', quality: 'huyen' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments).toEqual([
      { text: 'Huyền' },
      { text: '- Thanh Vân Kiếm' },
    ])
  })

  it('ghép tiền tố Địa Giới khi instance có zoneId đã đăng ký trong ZoneRegistry', () => {
    const { zoneRegistry } = setup()
    zoneRegistry.register({ id: 'thanh_van', name: 'Thanh Vân', stageIds: ['stage_1'] })
    const instance = makeInstance({ grade: 'bat_pham', quality: 'dia', zoneId: 'thanh_van' })

    const segments = composeEquipmentNameSegments(instance, TEMPLATE, zoneRegistry)

    expect(segments[1]?.text).toBe('- Thanh Vân Thanh Vân Kiếm')
  })

  it('composeEquipmentDisplayName joins the 2 segments with a space -> "Hoàng - Thanh Vân Kiếm"', () => {
    const { zoneRegistry } = setup()
    const instance = makeInstance({ grade: 'cuu_pham', quality: 'hoang' })

    expect(composeEquipmentDisplayName(instance, TEMPLATE, zoneRegistry)).toBe('Hoàng - Thanh Vân Kiếm')
  })
})

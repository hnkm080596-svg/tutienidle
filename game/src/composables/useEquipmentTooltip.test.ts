import { describe, expect, it } from 'vitest'
import { buildEquipmentTooltip, getEquipmentComparisonTone } from './useEquipmentTooltip'
import { AffixRegistry } from '@/core/equipment/AffixRegistry'
import { affixes } from '@/data/equipment/affixes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { Equipment } from '@/core/equipment/Equipment'
import { FormationRegistry } from '@/core/formation/FormationRegistry'
import { TalismanRegistry } from '@/core/talisman/TalismanRegistry'
import { ZoneRegistry } from '@/core/stage/ZoneRegistry'

function instance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    instanceId: 'a',
    itemId: 'test_sword',
    slot: 'weapon',
    equipped: false,
    quality: 'pham_khi',
    rarity: 'hoang',
    realmId: 'qi_refining',
    mainStat: { id: 'roll-main-attack', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 10 },
    affixes: [],
    forgePoints: 0,
    forgePotential: 100,
    ...overrides,
  }
}

function setup() {
  const affixRegistry = new AffixRegistry()
  for (const affix of affixes) affixRegistry.register(affix)
  return { affixRegistry }
}

// Slot Revamp (mục 17.7) — tone hiện NGAY trên SlotView (state.comparison),
// không chỉ trong tooltip — cùng nguồn tính delta với buildEquipmentTooltip
// (computeEquipmentStatDeltas), test riêng phần tổng hợp tone.
describe('getEquipmentComparisonTone', () => {
  it('neutral khi không có đồ đang mặc để so sánh', () => {
    const { affixRegistry } = setup()
    expect(getEquipmentComparisonTone(instance(), undefined, affixRegistry)).toBe('neutral')
  })

  it('neutral khi so với chính nó (cùng instanceId)', () => {
    const { affixRegistry } = setup()
    const self = instance({ instanceId: 'same' })
    expect(getEquipmentComparisonTone(self, self, affixRegistry)).toBe('neutral')
  })

  it('upgrade khi mainStat cao hơn đồ đang mặc', () => {
    const { affixRegistry } = setup()
    const equipped = instance({ instanceId: 'equipped', mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 10 } })
    const candidate = instance({ instanceId: 'candidate', mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 20 } })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('upgrade')
  })

  it('downgrade khi mainStat thấp hơn đồ đang mặc', () => {
    const { affixRegistry } = setup()
    const equipped = instance({ instanceId: 'equipped', mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 20 } })
    const candidate = instance({ instanceId: 'candidate', mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 10 } })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('downgrade')
  })

  it('neutral khi số stat tăng bằng số stat giảm (2 stat KHÁC nhau — attack lên, maxHp xuống)', () => {
    const { affixRegistry } = setup()
    const equipped = instance({
      instanceId: 'equipped',
      mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 10 },
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 20 }],
    })
    const candidate = instance({
      instanceId: 'candidate',
      mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 20 },
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 5 }],
    })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('neutral')
  })
})

describe('buildEquipmentTooltip', () => {
  it('dùng tên stat chuẩn và không lặp quality/rarity hay thiên hướng', () => {
    const { affixRegistry } = setup()
    const equipment = instance({
      rarity: 'dia',
      affixes: [
        { affixId: 'prefix_critical_rate', tier: 1, value: 0.02 },
        { affixId: 'suffix_accuracy', tier: 1, value: 4 },
      ],
    })
    const template: Equipment = {
      id: 'test_sword',
      name: 'Thanh Vân Kiếm',
      description: 'Kiếm thử nghiệm.',
      slot: 'weapon',
      grade: 1,
      mainStats: [{ stat: 'attack', min: 8, max: 12 }],
      maxEnhanceLevel: 10,
    }

    const tooltip = buildEquipmentTooltip(
      equipment,
      template,
      affixRegistry,
      null,
      new FormationRegistry(),
      new TalismanRegistry(),
      new ZoneRegistry(),
    )

    expect(tooltip.name).toContain('Địa')
    expect(tooltip).not.toHaveProperty('qualityLabel')
    expect(tooltip).not.toHaveProperty('gradeLabel')
    expect(tooltip.sections.some(section => section.label === 'Thiên hướng')).toBe(false)
    expect(tooltip.sections.find(section => section.label.startsWith('Chỉ Số Phụ'))?.rows.map(row => row.label))
      .toEqual(['Tỉ lệ bạo kích', 'Độ chính xác'])
  })

  it('hides range/comparison by default and keeps effective range plus delta inline for Alt mode', () => {
    const { affixRegistry } = setup()
    const candidate = instance({
      instanceId: 'candidate', realmId: 'mortal', realmLevel: 1,
      mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 14 },
    })
    const equipped = instance({
      instanceId: 'equipped', realmId: 'mortal', realmLevel: 1,
      mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 10 },
    })
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'attack', min: 12, max: 20 }], maxEnhanceLevel: 10,
    }
    const tooltip = buildEquipmentTooltip(
      candidate, template, affixRegistry, null,
      new FormationRegistry(), new TalismanRegistry(), new ZoneRegistry(), equipped,
    )

    expect(tooltip.sections[0]?.rows[0]?.value).toBe('+14')
    expect(tooltip.sections.some(section => section.label.startsWith('So với'))).toBe(false)
    expect(tooltip.advancedSections?.[0]?.rows[0]?.value).toContain('[13–21]')
    expect(tooltip.advancedSections?.[0]?.rows[0]?.value).toContain('▲ +4')
  })
})

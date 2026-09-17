import { describe, expect, it } from 'vitest'
import { buildEquipmentTooltip, getEquipmentComparisonTone } from './useEquipmentTooltip'
import { AffixRegistry } from '@/core/equipment/AffixRegistry'
import { affixes } from '@/data/equipment/affixes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'
import type { Equipment } from '@/core/equipment/Equipment'
import { ZoneRegistry } from '@/core/stage/ZoneRegistry'
import { composeEquipmentDisplayName } from '@/core/equipment/EquipmentNaming'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { createDefaultSlotState } from '@/core/equipment/EquipmentSlotState'
import { gradeLabel } from '@/core/presentation/labels'

function instance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeInstance({
    instanceId: 'a',
    itemId: 'test_sword',
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: { id: 'roll-main-might', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 10 },
    ...overrides,
  })
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
    const equipped = instance({ instanceId: 'equipped', mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 10 } })
    const candidate = instance({ instanceId: 'candidate', mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 20 } })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('upgrade')
  })

  it('downgrade khi mainStat thấp hơn đồ đang mặc', () => {
    const { affixRegistry } = setup()
    const equipped = instance({ instanceId: 'equipped', mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 20 } })
    const candidate = instance({ instanceId: 'candidate', mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 10 } })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('downgrade')
  })

  it('neutral khi số stat tăng bằng số stat giảm (2 stat KHÁC nhau — might lên, maxHp xuống)', () => {
    const { affixRegistry } = setup()
    const equipped = instance({
      instanceId: 'equipped',
      mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 10 },
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 20 }],
    })
    const candidate = instance({
      instanceId: 'candidate',
      mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 20 },
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 5 }],
    })

    expect(getEquipmentComparisonTone(candidate, equipped, affixRegistry)).toBe('neutral')
  })
})

describe('buildEquipmentTooltip', () => {
  it('dùng tên stat chuẩn và không lặp quality/rarity hay thiên hướng', () => {
    const { affixRegistry } = setup()
    const equipment = instance({
      quality: 'dia',
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
      mainStats: [{ stat: 'might', min: 8, max: 12 }],
      maxEnhanceLevel: 10,
    }

    const tooltip = buildEquipmentTooltip(
      equipment,
      template,
      affixRegistry,
      null,
      new ZoneRegistry(),
      undefined,
      undefined,
    )

    expect(tooltip.name).toContain('Địa')
    expect(tooltip).not.toHaveProperty('qualityLabel')
    expect(tooltip).not.toHaveProperty('gradeLabel')
    expect(tooltip.sections.some(section => section.label === 'Thiên hướng')).toBe(false)
    expect(tooltip.sections.find(section => section.label.startsWith('Chỉ Số Phụ'))?.rows.map(row => row.label))
      .toEqual(['Tỉ lệ bạo kích', 'Độ chính xác'])
  })

  // Naming rework (2026-09-14): Pham renders as the "Canh gioi" meta
  // line under the title; Chat lives on the name segments - the old
  // "Phan Loai" section is redundant and gone.
  it('shows gradeLine "Cảnh giới: ..." for Pham; the Phân Loại section is gone', () => {
    const { affixRegistry } = setup()
    const equipment = instance({ grade: 'bat_pham', quality: 'dia' })
    const template: Equipment = {
      id: 'test_sword',
      name: 'Thanh Vân Kiếm',
      slot: 'weapon',
      grade: 1,
      mainStats: [{ stat: 'might', min: 8, max: 12 }],
      maxEnhanceLevel: 10,
    }

    const tooltip = buildEquipmentTooltip(equipment, template, affixRegistry, null, new ZoneRegistry(), undefined, undefined)

    expect(tooltip.gradeLine).toContain('Bát Phẩm')
    expect(tooltip.gradeLine).toContain('Luyện Khí')
    expect(tooltip.sections.some(section => section.label === 'Phân Loại')).toBe(false)

    // sections[0] (Chi So Chinh) keeps its position.
    expect(tooltip.sections[0]?.label).toBe('Chỉ Số Chính')
  })

  // Item-info-card spec section 3 - advancedSections merged into
  // sections: range/delta live on the rows themselves, no Alt-revealed
  // second list.
  it('ranges render inline in sections - advancedSections is gone', () => {
    const { affixRegistry } = setup()
    const equipment = instance({
      grade: 'cuu_pham', realmLevel: 1,
      mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 14 },
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 15 }],
    })
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 12, max: 20 }], maxEnhanceLevel: 10,
    }

    const content = buildEquipmentTooltip(
      equipment,
      template,
      affixRegistry,
      null,
      new ZoneRegistry(),
      undefined,
      { min: 12, max: 20 },
    )

    const mainRow = content.sections[0]!.rows[0]!
    expect(mainRow.value).toBe('+14')
    expect(mainRow.range).toMatch(/^\[.+–.+\]$/)

    // Affix rows carry their tier range inline too (prefix_max_hp t1 = 10-20).
    const affixRow = content.sections.find(section => section.label.startsWith('Chỉ Số Phụ'))?.rows[0]
    expect(affixRow?.range).toBe('[10–20]')

    expect('advancedSections' in content).toBe(false)
  })

  // Item-info-card spec section 4 - ONE compare context drives both the paired
  // card (compareWith) and the inline delta markers on the candidate's
  // rows; the equipped card itself never nests another compare.
  it('compare context emits compareWith (equipped card) + delta fields on rows', () => {
    const { affixRegistry } = setup()
    const zoneRegistry = new ZoneRegistry()
    const equipped = instance({
      instanceId: 'equipped', grade: 'cuu_pham', realmLevel: 1,
      mainStat: { id: 'y', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 10 },
    })
    const candidate = instance({
      instanceId: 'candidate', grade: 'cuu_pham', realmLevel: 1,
      mainStat: { id: 'x', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 14 },
    })
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 12, max: 20 }], maxEnhanceLevel: 10,
    }

    const content = buildEquipmentTooltip(candidate, template, affixRegistry, null, zoneRegistry, {
      instance: equipped, template, slotState: null, mainStatRangeQuote: undefined,
    }, undefined)

    expect(content.compareWith?.name).toBe(composeEquipmentDisplayName(equipped, template, zoneRegistry))
    expect(content.compareWith && 'compareWith' in content.compareWith).toBe(false)

    const deltaRow = content.sections.flatMap(section => section.rows).find(row => row.delta)
    expect(deltaRow?.delta).toMatch(/[▲▼]/)
    expect(deltaRow?.delta).toContain('+4')
    expect(deltaRow?.deltaTone).toMatch(/positive|negative/)
  })

  // Stats only on the equipped counterpart render as muted "+0" rows in
  // the SAME affix section (no separate advanced list), carrying the
  // negative delta.
  it('equipped-only stats land as muted rows in the affix section', () => {
    const { affixRegistry } = setup()
    const zoneRegistry = new ZoneRegistry()
    const equipped = instance({
      instanceId: 'equipped',
      affixes: [{ affixId: 'prefix_max_hp', tier: 1, value: 20 }],
    })
    const candidate = instance({ instanceId: 'candidate' })
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 8, max: 12 }], maxEnhanceLevel: 10,
    }

    const content = buildEquipmentTooltip(candidate, template, affixRegistry, null, zoneRegistry, {
      instance: equipped, template, slotState: null, mainStatRangeQuote: undefined,
    }, undefined)

    const affixSection = content.sections.find(section => section.label.startsWith('Chỉ Số Phụ'))
    const missingRow = affixSection?.rows.find(row => row.tone === 'muted')
    expect(missingRow?.label).toBe('Khí huyết')
    expect(missingRow?.delta).toContain('▼')
    expect(missingRow?.deltaTone).toBe('negative')
  })

  // Item-info-card spec section 2 - single title color on the Chat ramp:
  // quality rank 1-5 spread onto odd steps 1-3-5-7-9 of the 10-step
  // --rank-color scale; 'tien' upgrades to the rainbow tone.
  it('title payload: nameColorVar = --rank-color-(2*qualityRank-1), tien => rainbow tone', () => {
    const { affixRegistry } = setup()
    const tienInstance = instance({ quality: 'tien' })
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 8, max: 12 }], maxEnhanceLevel: 10,
    }

    const content = buildEquipmentTooltip(tienInstance, template, affixRegistry, null, new ZoneRegistry(), undefined, undefined)

    expect(content.nameColorVar).toBe('--rank-color-9')
    expect(content.nameTone).toBe('tien')
  })

  // Item-info-card spec section 3 - the card's static SlotView header binds the
  // same signal set the bag cell carries (seal rank + Chat edge + aria
  // with the grade word).
  it('slotPreview carries the cell signal set (seal rank + chat edge + aria with grade)', () => {
    const { affixRegistry } = setup()
    const equipment = instance()
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 8, max: 12 }], maxEnhanceLevel: 10,
    }

    const content = buildEquipmentTooltip(equipment, template, affixRegistry, null, new ZoneRegistry(), undefined, undefined)

    expect(content.slotPreview?.equipmentQualityRank).toBe(professionGradeRank(equipment.grade))
    expect(content.slotPreview?.rarityRank).toBe(itemQualityRank(equipment.quality))
    expect(content.slotPreview?.accessibleLabel).toContain(gradeLabel(equipment.grade))
  })
  // T4-34 - the tooltip's enhance cap is the SLOT cap (MAX_SLOT_ENHANCE_LEVEL
  // = 100), not template.maxEnhanceLevel (the legacy field = 10 on every
  // template - reading it as a per-item cap was the bug).
  it('enhance row shows the slot cap (MAX_SLOT_ENHANCE_LEVEL), not template.maxEnhanceLevel', () => {
    const { affixRegistry } = setup()
    const equipment = instance()
    const template: Equipment = {
      id: 'test_sword', name: 'Kiếm', slot: 'weapon', grade: 1,
      mainStats: [{ stat: 'might', min: 8, max: 12 }], maxEnhanceLevel: 10,
    }
    const slotState = { ...createDefaultSlotState('weapon'), enhanceLevel: 45 }

    const content = buildEquipmentTooltip(equipment, template, affixRegistry, slotState, new ZoneRegistry(), undefined, undefined)

    const forgeSection = content.sections.find(section => section.rows.some(row => row.label === 'Cường Hóa'))
    const row = forgeSection?.rows.find(r => r.label === 'Cường Hóa')
    expect(row?.value).toBe('+45/100')
  })
})

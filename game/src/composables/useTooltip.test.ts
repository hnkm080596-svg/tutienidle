// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTooltip } from './useTooltip'

describe('useTooltip owner lifecycle', () => {
  afterEach(() => {
    useTooltip().dismissTooltip()
    vi.useRealTimers()
  })

  it('mở ngay, neo owner và gắn aria-describedby', () => {
    vi.useFakeTimers()
    const owner = document.createElement('button')
    const tooltip = useTooltip()

    tooltip.showTooltip({ title: 'Kiếm' }, owner)
    expect(tooltip.content.value).toEqual({ title: 'Kiếm' })
    expect(tooltip.reference.value).toBe(owner)
    expect(owner.getAttribute('aria-describedby')).toBe('global-tooltip')
  })

  it('owner cũ không thể đóng tooltip vừa chuyển sang owner mới', () => {
    vi.useFakeTimers()
    const first = document.createElement('button')
    const second = document.createElement('button')
    const tooltip = useTooltip()
    tooltip.showTooltip({ title: 'A' }, first, true)
    tooltip.showTooltip({ title: 'B' }, second, true)

    tooltip.hideTooltip(first, true)

    expect(tooltip.content.value).toEqual({ title: 'B' })
    expect(tooltip.reference.value).toBe(second)
  })

  // Item-info-card payload contract (Tasks 3-4): the new fields round-
  // trip through the queue untouched — slotPreview, single-color name,
  // ownedCount, row range/delta.
  it('chấp nhận payload contract mới (slotPreview/nameColorVar/ownedCount/range/delta)', () => {
    vi.useFakeTimers()
    const owner = document.createElement('button')
    const tooltip = useTooltip()

    tooltip.showTooltip(
      {
        kind: 'material',
        name: 'Linh Thảo',
        nameColorVar: '--rank-color-5',
        slotPreview: {
          icon: '/icons/herb.png',
          label: 'Linh Thảo',
          accessibleLabel: 'Linh Thảo, Luyện Khí',
          rarityRank: 5,
          rarityRankScale: 10,
        },
        gradeRank: 5,
        ownedCount: 3,
        sections: [{ label: 'Thông Tin', rows: [{ label: 'Loại', value: 'Thảo', range: '[1–2]', delta: '▲ +1', deltaTone: 'positive' }] }],
      },
      owner,
    )

    const shown = tooltip.content.value
    expect(shown?.kind).toBe('material')
    expect(shown).not.toHaveProperty('nameSegments')
    expect(shown).not.toHaveProperty('ownedLabel')
    expect(shown).not.toHaveProperty('gradeLineColorVar')
  })

  // Compare pair contract (Task 5): an equipment payload may carry one
  // equipped counterpart card — the pair stops at depth 1 by type.
  it('chấp nhận equipment compareWith (equipped counterpart, non-recursive)', () => {
    vi.useFakeTimers()
    const owner = document.createElement('button')
    const tooltip = useTooltip()

    const equipped = {
      kind: 'equipment' as const,
      name: 'Địa - Hắc Thiết Kiếm',
      nameColorVar: '--rank-color-5',
      slotLabel: 'Vũ Khí',
      qualityKey: 'dia',
      sections: [],
    }

    tooltip.showTooltip(
      {
        ...equipped,
        name: 'Hoàng - Thanh Vân Kiếm',
        compareWith: equipped,
      },
      owner,
    )

    const shown = tooltip.content.value
    expect(shown?.kind).toBe('equipment')
    if (shown?.kind === 'equipment') {
      expect(shown.compareWith?.name).toBe('Địa - Hắc Thiết Kiếm')
      expect(shown.compareWith && 'compareWith' in shown.compareWith).toBe(false)
    }
  })
})

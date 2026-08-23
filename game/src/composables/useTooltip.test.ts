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
})

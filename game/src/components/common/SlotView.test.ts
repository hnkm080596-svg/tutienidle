// @vitest-environment jsdom
//
// Không có @vue/test-utils trong project (mọi test khác chỉ test core
// logic thuần TS) — mount thẳng bằng API công khai của Vue
// (createApp/h) thay vì thêm dependency mới, vẫn render đúng SFC thật
// qua @vitejs/plugin-vue đã cấu hình sẵn trong vite.config.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import SlotView from './SlotView.vue'
import { vTooltip } from '@/directives/tooltip'
import { useTooltip } from '@/composables/useTooltip'

// Test fixture nhận props lỏng (từng case chỉ truyền 1 phần) — ép kiểu
// tại đây vì SlotView props thật (generic + nhiều optional) không thể
// biểu diễn gọn bằng Partial thông thường cho mục đích test.
function mountSlot(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: () => h(SlotView as any, props),
  })

  app.directive('tooltip', vTooltip)
  app.mount(container)

  return {
    container,
    button: container.querySelector('button.slot-view') as HTMLButtonElement,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  useTooltip().dismissTooltip()
})

describe('SlotView — empty/filled + icon fallback', () => {
  it('slot trống dùng class --empty, không có monogram', () => {
    const { button, unmount } = mountSlot({ item: null, label: 'Trống' })

    expect(button.classList.contains('slot-view--empty')).toBe(true)
    expect(button.querySelector('.slot-view__monogram')).toBeNull()
    unmount()
  })

  it('slot có item không có icon rơi về monogram = chữ cái đầu label', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm' })

    expect(button.classList.contains('slot-view--filled')).toBe(true)
    expect(button.querySelector('.slot-view__monogram')?.textContent).toBe('K')
    unmount()
  })

  it('icon lỗi tải (error) ẩn <img>, monogram hiện ra thay thế', async () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', icon: '/broken.png' })

    const img = button.querySelector('.slot-view__item-icon') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(button.querySelector('.slot-view__monogram')).toBeNull()

    img.dispatchEvent(new Event('error'))
    await Promise.resolve()
    await Promise.resolve()

    expect(button.querySelector('.slot-view__item-icon')).toBeNull()
    expect(button.querySelector('.slot-view__monogram')?.textContent).toBe('K')
    unmount()
  })
})

describe('SlotView — rank 1-9 / 1-3-5-7-9', () => {
  it('equipmentQualityRank ánh xạ đúng --slot-quality-color = --rank-color-N', () => {
    for (const rank of [1, 5, 9]) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', equipmentQualityRank: rank })
      expect(button.style.getPropertyValue('--slot-quality-color')).toBe(`var(--rank-color-${rank})`)
      unmount()
    }
  })

  it('equipmentQualityRank (Chất) chỉ hiện chip phụ khi có giá trị, map đúng rank vào --slot-quality-color', () => {
    for (const rank of [1, 3, 5, 7, 9]) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', equipmentQualityRank: rank })
      expect(button.querySelector('.slot-view__quality-chip')).not.toBeNull()
      expect(button.style.getPropertyValue('--slot-quality-color')).toBe(`var(--rank-color-${rank})`)
      unmount()
    }
  })

  it('không truyền equipmentQualityRank thì không render chip phụ', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X' })
    expect(button.querySelector('.slot-view__quality-chip')).toBeNull()
    unmount()
  })

  it('rarityRank (Phẩm) = 9 gắn class --max-rank (viền gradient bảy màu) — Phẩm quyết định khung, không phải Chất', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: 9 })
    expect(button.classList.contains('slot-view--max-rank')).toBe(true)
    unmount()
  })
})

describe('SlotView — precedence (mục 17.2)', () => {
  it('locked: chặn click, chặn validation, vẫn aria-disabled + tooltip hoạt động', () => {
    const onClick = vi.fn()
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'Khoá',
      description: 'Cần đạt Trúc Cơ',
      state: { availability: 'locked', validation: 'invalid' },
      onClick,
    })

    button.click()
    expect(onClick).not.toHaveBeenCalled()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.classList.contains('slot-view--veil-locked')).toBe(true)
    // rule 1: locked chặn validation — không còn class validation-invalid
    expect(button.classList.contains('slot-view--validation-invalid')).toBe(false)

    button.dispatchEvent(new Event('focusin'))
    expect(useTooltip().content.value).toEqual({ title: 'Khoá', description: 'Cần đạt Trúc Cơ' })
    unmount()
  })

  it('disabled: chặn click nhưng KHÔNG chặn validation', () => {
    const onClick = vi.fn()
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      state: { availability: 'disabled', validation: 'missing' },
      onClick,
    })

    button.click()
    expect(onClick).not.toHaveBeenCalled()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.classList.contains('slot-view--validation-missing')).toBe(true)
    unmount()
  })

  it('processing: chặn click, aria-busy, vẫn giữ Quality color', () => {
    const onClick = vi.fn()
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      equipmentQualityRank: 5,
      state: { interaction: 'processing' },
      onClick,
    })

    button.click()
    expect(onClick).not.toHaveBeenCalled()
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.style.getPropertyValue('--slot-quality-color')).toBe('var(--rank-color-5)')
    unmount()
  })

  it('selected không che validation — cả 2 cùng hiện', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      state: { interaction: 'selected', validation: 'valid' },
    })

    expect(button.classList.contains('slot-view--selected')).toBe(true)
    expect(button.classList.contains('slot-view--validation-valid')).toBe(true)
    unmount()
  })

  it('available + idle: click emit bình thường', () => {
    const onClick = vi.fn()
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', onClick })

    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    unmount()
  })
})

describe('SlotView — badge/marker/comparison/amount/caption', () => {
  it('badge enhance render đúng text', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      badges: [{ kind: 'enhance', text: '+3' }],
    })

    expect(button.querySelector('.slot-view__badge--enhance')?.textContent?.trim()).toBe('+3')
    unmount()
  })

  it('marker equipped + comparison upgrade cùng hiện, không đổi màu Quality', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      state: { marker: 'equipped', comparison: 'upgrade' },
    })

    expect(button.querySelector('.slot-view__marker--equipped')).not.toBeNull()
    expect(button.querySelector('.slot-view__comparison--upgrade')).not.toBeNull()
    unmount()
  })

  it('amount và caption cùng render, không đè nhau (2 element riêng)', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Linh Thạch', amount: 42 })

    expect(button.querySelector('.slot-view__amount')?.textContent).toContain('42')
    expect(button.querySelector('.slot-view__caption')?.textContent).toBe('Linh Thạch')
    unmount()
  })
})

describe('SlotView — accessibility', () => {
  it('accessibleLabel ưu tiên hơn label cho aria-label', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', accessibleLabel: 'Kiếm, đã trang bị' })
    expect(button.getAttribute('aria-label')).toBe('Kiếm, đã trang bị')
    unmount()
  })

  it('không truyền accessibleLabel thì fallback về label', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm' })
    expect(button.getAttribute('aria-label')).toBe('Kiếm')
    unmount()
  })

  it('button luôn focusable (không dùng disabled thật) kể cả khi locked', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', state: { availability: 'locked' } })
    expect(button.disabled).toBe(false)
    unmount()
  })
})

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

  it('variant prop map sang class slot-view--{variant} (item default)', () => {
    const item = mountSlot({ item: null, label: 'Trống' })
    const equip = mountSlot({ item: null, label: 'Trống', variant: 'equipment' })

    expect(item.button.classList.contains('slot-view--item')).toBe(true)
    expect(equip.button.classList.contains('slot-view--equipment')).toBe(true)
    item.unmount(); equip.unmount()
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

describe('SlotView — rank 1-10 (professionGradeRank) / 1-5 (itemQualityRank)', () => {
  // The Pham axis renders as a corner seal stamp carrying the
  // Vietnamese grade ordinal (item-info-card spec 2026-09-14) -
  // replaces the transparent underlay wash.
  it('Pham renders as a corner seal with the Vietnamese grade ordinal', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', equipmentQualityRank: 5 })
    const seal = button.querySelector('.slot-view__seal')

    expect(seal).not.toBeNull()
    expect(seal?.textContent).toBe('NGŨ')
    expect(seal?.getAttribute('aria-hidden')).toBe('true')
    unmount()
  })

  it('seal rim follows --rank-color-N of the Pham rank', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', equipmentQualityRank: 10 })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('TIÊN')
    expect(button.getAttribute('style')).toContain('--seal-rim: var(--rank-color-10)')
    unmount()
  })

  it('material scale-10 rank feeds the seal through rarityRank', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Thảo', rarityRank: 3, rarityRankScale: 10 })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('THẤT')
    unmount()
  })

  it('equipment 2 trục: seal theo Phẩm (equipmentQualityRank), KHÔNG theo Chất (rarityRank)', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      equipmentQualityRank: 2,
      rarityRank: 5,
    })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('BÁT')
    expect(button.style.getPropertyValue('--seal-rim')).toBe('var(--rank-color-2)')
    unmount()
  })

  it('no rank anywhere => no seal; empty slot never seals', () => {
    const filled = mountSlot({ item: { id: 1 }, label: 'X' })
    expect(filled.button.querySelector('.slot-view__seal')).toBeNull()
    filled.unmount()

    const empty = mountSlot({ item: null, label: 'X', equipmentQualityRank: 5 })
    expect(empty.button.querySelector('.slot-view__seal')).toBeNull()
    empty.unmount()
  })

  it('rarityRank (Chất, thang 5) tô khung theo dải --grade-*: rank r -> --rank-color-(2r-1)', () => {
    for (const [rank, ramp] of [[1, 1], [3, 5], [5, 9]] as const) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: rank })
      expect(button.style.getPropertyValue('--slot-rarity-color')).toBe(`var(--rank-color-${ramp})`)
      unmount()
    }
  })

  it('rarityRank (Phẩm) = 5 (Tiên Chất, trần mới sau rework P6) gắn class --max-rank (viền gradient bảy màu) — Phẩm quyết định khung, không phải Chất', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: 5 })
    expect(button.classList.contains('slot-view--max-rank')).toBe(true)
    unmount()
  })

  it('rarityRank = 9 (trần cũ trước rework P6) KHÔNG còn là max — trần mới là 5', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: 9 })
    expect(button.classList.contains('slot-view--max-rank')).toBe(false)
    unmount()
  })
})

describe('SlotView — static presentation mode (item-info-card 2026-09-14)', () => {
  it('static mode: renders span role=img, no button, no tooltip emission, no click', () => {
    const onClick = vi.fn()
    const { container, unmount } = mountSlot({
      item: { id: 1 },
      label: 'Kiếm',
      static: true,
      tooltip: { title: 'x' },
      onClick,
    })
    const root = container.querySelector('.slot-view') as HTMLElement

    expect(root.tagName).toBe('SPAN')
    expect(container.querySelector('button.slot-view')).toBeNull()
    expect(root.getAttribute('role')).toBe('img')
    expect(root.getAttribute('aria-label')).toBe('Kiếm')

    root.click()
    expect(onClick).not.toHaveBeenCalled()

    root.dispatchEvent(new Event('focusin'))
    expect(useTooltip().content.value).toBeNull()
    unmount()
  })
})

describe('SlotView — rarityRankScale (Fix 1, final review item-grade-quality-rework)', () => {
  it('không truyền rarityRankScale (mặc định 5) — hành vi equipment cũ không đổi: rank 5 = max', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: 5 })
    expect(button.classList.contains('slot-view--max-rank')).toBe(true)
    unmount()
  })

  it('rarityRankScale = 10: material rank 5 (Ngũ Phẩm, GIỮA thang 1-10) KHÔNG được gắn max-rank', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      rarityRank: 5,
      rarityRankScale: 10,
    })
    expect(button.classList.contains('slot-view--max-rank')).toBe(false)
    unmount()
  })

  it('rarityRankScale = 10: material rank 10 (Tiên Phẩm, ĐỈNH thang) ĐƯỢC gắn max-rank', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      rarityRank: 10,
      rarityRankScale: 10,
    })
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
    expect(button.style.getPropertyValue('--seal-rim')).toBe('var(--rank-color-5)')
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

  it('amount render; nametag caption đã bỏ — tên nằm trong tooltip (user ruling)', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Linh Thạch', amount: 42 })

    expect(button.querySelector('.slot-view__amount')?.textContent).toContain('42')
    expect(button.querySelector('.slot-view__caption')).toBeNull()
    unmount()
  })
})

describe('SlotView — Chat aura (equipment quality indicator, user art pass)', () => {
  // User ruling: the old hover-only blue beam becomes a persistent
  // quality indicator — only equipment with ItemQuality Dia (rank 3 on
  // the 5-step scale) and above shows it; each tier gets the rank color.
  // Materials on the 10-step scale are NOT equipment Chat — no aura.
  it('trang bị Chất Địa (rarityRank = 3) — vòng sáng TĨNH tô màu grade ramp, không beam quay', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: 3 })

    expect(button.classList.contains('slot-view--quality-fx-3')).toBe(true)
    // Chat axis maps onto the shared ramp at the --grade-* positions
    // (rank r -> --rank-color-(2r-1)) so slot aura matches the name tint.
    expect(button.style.getPropertyValue('--fx-beam-color')).toBe('var(--rank-color-5)')
    // Dia = static ring, no spinning beam (zero repaint cost on the tier
    // that stays common mid-game).
    expect(button.classList.contains('fx-border-beam--active')).toBe(false)
    unmount()
  })

  it('trang bị Chất Thiên/Tiên (rarityRank 4-5) — beam thường trực tô màu grade ramp', () => {
    for (const [rank, ramp] of [[4, 7], [5, 9]] as const) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: rank })

      expect(button.classList.contains('fx-border-beam--active')).toBe(true)
      expect(button.style.getPropertyValue('--fx-beam-color')).toBe(`var(--rank-color-${ramp})`)
      expect(button.classList.contains(`slot-view--quality-fx-${rank}`)).toBe(true)
      unmount()
    }
  })

  it('trang bị dưới Địa (rarityRank 1-2) — KHÔNG có indicator', () => {
    for (const rank of [1, 2]) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', rarityRank: rank })

      expect(button.classList.contains('fx-border-beam--active')).toBe(false)
      unmount()
    }
  })

  it('material thang 10 (rarityRankScale=10) rank >= 3 vẫn KHÔNG có aura — không phải Chất trang bị', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      rarityRank: 5,
      rarityRankScale: 10,
    })

    expect(button.classList.contains('fx-border-beam--active')).toBe(false)
    unmount()
  })

  it('slot trống không aura dù rarityRank được truyền', () => {
    const { button, unmount } = mountSlot({ item: null, label: 'X', rarityRank: 5 })

    expect(button.classList.contains('fx-border-beam--active')).toBe(false)
    unmount()
  })

  it('hover-frame layer (slot-frame-hover.png) luôn có trong DOM, CSS điều khiển hiển thị', () => {
    const { button, unmount } = mountSlot({ item: null, label: 'X' })

    expect(button.querySelector('.slot-view__hover-frame')).not.toBeNull()
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

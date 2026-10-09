// @vitest-environment jsdom
//
// Khong co @vue/test-utils trong project (moi test khac chi test core
// logic thuan TS) - mount thang bang API cong khai cua Vue
// (createApp/h) thay vi them dependency moi, van render dung SFC that
// qua @vitejs/plugin-vue da cau hinh san trong vite.config.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import SlotView from './SlotView.vue'
import { vTooltip } from '@/directives/tooltip'
import { useTooltip } from '@/composables/useTooltip'

// Test fixture nhan props long (tung case chi truyen 1 phan) - ep kieu
// tai day vi SlotView props that (generic + nhieu optional) khong the
// bieu dien gon bang Partial thong thuong cho muc dich test.
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
  // Han grade glyph (item-info-card spec 2026-09-14) -
  // replaces the transparent underlay wash.
  it('Pham renders as a corner seal with the Han grade glyph', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', equipmentQualityRank: 5 })
    const seal = button.querySelector('.slot-view__seal')

    expect(seal).not.toBeNull()
    expect(seal?.textContent).toBe('五')
    expect(seal?.getAttribute('aria-hidden')).toBe('true')
    unmount()
  })

  it('seal glyph for rank 10 is the immortal mark', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Kiếm', equipmentQualityRank: 10 })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('仙')
    unmount()
  })

  it('material scale-10 rank feeds the seal through rarityRank', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Thảo', rarityRank: 3, rarityRankScale: 10 })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('七')
    unmount()
  })

  it('equipment 2 axes: seal follows Pham (equipmentQualityRank), NOT Chat (rarityRank)', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      equipmentQualityRank: 2,
      rarityRank: 5,
    })

    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('八')
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

  it('rarityRank (Chat, 5-step scale) tints the frame via the --grade-* ramp: rank r -> --rank-color-(2r-1)', () => {
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

describe('SlotView - static presentation mode (item-info-card 2026-09-14)', () => {
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
    // rule 1: locked chan validation - khong con class validation-invalid
    expect(button.classList.contains('slot-view--validation-invalid')).toBe(false)

    // Focus tooltips only appear for keyboard focus navigation - a bare
    // focusin (e.g. programmatic focus-on-open) must not mount one, so
    // the test models a real keyboard user with a Tab keydown first.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
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
    expect(button.querySelector('.slot-view__seal')?.textContent).toBe('五')
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

  it('amount renders; nametag caption removed - the name lives in the tooltip (user ruling)', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'Linh Thạch', amount: 42 })

    expect(button.querySelector('.slot-view__amount')?.textContent).toContain('42')
    expect(button.querySelector('.slot-view__caption')).toBeNull()
    unmount()
  })
})

describe('SlotView - Chat meteors (equipment quality indicator, owner ruling 2026-10-08)', () => {
  // Owner ruling: the Chat channel is the groove 'sao bang' meteor
  // layer (slot-view__chat), twin streaks in the art groove tinted by
  // --slot-rarity-color. Chat 1 (Hoang, lowest) gets NO streak; the
  // effect starts at Huyen (rank 2). Materials on the 10-step scale
  // are NOT equipment Chat. The old border-beam channel was removed.
  it('Chat >= 2 on art-frame variants renders the meteor layer tinted by the grade ramp', () => {
    for (const [rank, ramp] of [[2, 3], [3, 5], [4, 7], [5, 9]] as const) {
      const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', variant: 'equipment', rarityRank: rank })

      expect(button.querySelector('.slot-view__chat')).not.toBeNull()
      expect(button.style.getPropertyValue('--slot-rarity-color')).toBe(`var(--rank-color-${ramp})`)
      unmount()
    }
  })

  it('Chat 1 (rarityRank = 1) - NO meteor', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', variant: 'equipment', rarityRank: 1 })

    expect(button.querySelector('.slot-view__chat')).toBeNull()
    unmount()
  })

  it('socket variant renders the meteor too (same channel)', () => {
    const { button, unmount } = mountSlot({ item: { id: 1 }, label: 'X', variant: 'socket', rarityRank: 2 })

    expect(button.querySelector('.slot-view__chat')).not.toBeNull()
    unmount()
  })

  it('material on the 10-step scale (rarityRankScale=10) has NO meteor - not equipment Chat', () => {
    const { button, unmount } = mountSlot({
      item: { id: 1 },
      label: 'X',
      variant: 'equipment',
      rarityRank: 5,
      rarityRankScale: 10,
    })

    expect(button.querySelector('.slot-view__chat')).toBeNull()
    unmount()
  })

  it('empty slot shows no meteor even when rarityRank is passed', () => {
    const { button, unmount } = mountSlot({ item: null, label: 'X', variant: 'equipment', rarityRank: 5 })

    expect(button.querySelector('.slot-view__chat')).toBeNull()
    unmount()
  })

  it('hover-frame layer (slot-frame-hover.png) is always in the DOM, CSS controls visibility', () => {
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

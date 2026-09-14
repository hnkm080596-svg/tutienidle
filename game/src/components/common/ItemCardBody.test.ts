// @vitest-environment jsdom
//
// No @vue/test-utils in this project - tests mount the real SFC via
// createApp/h (same pattern as SlotView.test.ts). The v-tooltip
// directive must be registered because ItemCardBody's static SlotView
// still binds it (with an undefined value in static mode).
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import ItemCardBody from './ItemCardBody.vue'
import Tooltip from './Tooltip.vue'
import { vTooltip } from '@/directives/tooltip'
import { useTooltip } from '@/composables/useTooltip'
import type { EquipmentTooltipContent, GradedItemTooltipContent } from '@/composables/useTooltip'

const cleanup: Array<() => void> = []

function mountCard(content: EquipmentTooltipContent | GradedItemTooltipContent, eyebrow?: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(ItemCardBody, { content, eyebrow }) })
  app.directive('tooltip', vTooltip)
  app.mount(container)

  cleanup.push(() => {
    app.unmount()
    container.remove()
  })
  return container
}

// Mounts the global Tooltip itself so a real showTooltip() payload
// exercises the compare-pair wiring end to end (Teleport -> body).
function mountTooltipApp() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(Tooltip) })
  app.directive('tooltip', vTooltip)
  app.mount(container)

  cleanup.push(() => {
    app.unmount()
    container.remove()
  })
}

afterEach(() => {
  useTooltip().dismissTooltip()
  for (const dispose of cleanup.splice(0)) dispose()
})

const equipmentContent: EquipmentTooltipContent = {
  kind: 'equipment',
  name: 'Hoàng - Thanh Vân Kiếm',
  nameColorVar: '--rank-color-5',
  slotPreview: {
    label: 'Hoàng - Thanh Vân Kiếm',
    accessibleLabel: 'Hoàng - Thanh Vân Kiếm, Ngũ Phẩm',
    equipmentQualityRank: 5,
    rarityRank: 3,
  },
  slotLabel: 'Vũ Khí',
  qualityKey: 'dia',
  gradeLine: 'Cảnh giới: Ngũ Phẩm (Nguyên Anh)',
  sections: [
    {
      label: 'Chỉ Số Chính',
      rows: [{ label: 'Sức Mạnh', value: '+42', range: '[30–55]', delta: '▲ +2', deltaTone: 'positive' }],
    },
    {
      label: 'Chỉ Số Phụ',
      rows: [
        { label: 'Bạo Kích', value: '+8%', range: '[5–12]', tier: 3 },
        { label: 'Xuyên Giáp', value: '+4', tier: 1, delta: '▼ -1', deltaTone: 'negative' },
      ],
    },
  ],
  description: 'Kiếm khí ngưng tụ thành hình.',
}

const gradedContent: GradedItemTooltipContent = {
  kind: 'material',
  name: 'Linh Thảo',
  nameColorVar: '--rank-color-5',
  slotPreview: {
    label: 'Linh Thảo',
    accessibleLabel: 'Linh Thảo, Luyện Khí',
    rarityRank: 5,
    rarityRankScale: 10,
  },
  gradeRank: 5,
  sections: [{ label: 'Thông Tin', rows: [{ label: 'Phân Loại', value: 'Linh Thảo' }] }],
}

describe('ItemCardBody - static SlotView header (spec section 3)', () => {
  it('binds slotPreview onto a static SlotView: span role=img, seal, accessibleLabel passthrough', () => {
    const container = mountCard(equipmentContent)
    const slot = container.querySelector('.item-card__slot') as HTMLElement

    expect(slot).not.toBeNull()
    expect(slot.tagName).toBe('SPAN')
    expect(slot.getAttribute('role')).toBe('img')
    expect(slot.getAttribute('aria-label')).toBe('Hoàng - Thanh Vân Kiếm, Ngũ Phẩm')
    // The seal + Chat edge ride along from the same props the cell binds.
    expect(slot.querySelector('.slot-view__seal')?.textContent).toBe('NGŨ')
    expect(container.querySelector('button.slot-view')).toBeNull()
  })

  it('material scale-10 slotPreview feeds the seal through rarityRank', () => {
    const container = mountCard(gradedContent)
    expect(container.querySelector('.slot-view__seal')?.textContent).toBe('NGŨ')
  })

  it('falls back to the icon shell when slotPreview is absent', () => {
    const container = mountCard({ ...gradedContent, slotPreview: undefined, imagePath: '/icons/herb.png' })

    expect(container.querySelector('.item-card__icon-shell')).not.toBeNull()
    expect(container.querySelector('.slot-view')).toBeNull()
  })
})

describe('ItemCardBody - single-color title (spec section 2)', () => {
  it('applies nameColorVar to the whole title - no per-segment spans', () => {
    const container = mountCard(equipmentContent)
    const title = container.querySelector('.item-card__title') as HTMLElement

    expect(title.getAttribute('style')).toContain('color: var(--rank-color-5)')
    expect(title.children.length).toBe(0)
    expect(title.textContent).toBe('Hoàng - Thanh Vân Kiếm')
  })

  it('max-rank nameTone gets the rainbow class instead of the color', () => {
    const container = mountCard({ ...equipmentContent, nameTone: 'tien' })
    const title = container.querySelector('.item-card__title') as HTMLElement

    expect(title.classList.contains('item-card__title--max-rank')).toBe(true)
    expect(title.getAttribute('style') ?? '').not.toContain('--rank-color-5')
  })
})

describe('ItemCardBody - stat rows (range/delta/tier)', () => {
  it('renders range muted inline and delta with its tone class', () => {
    const container = mountCard(equipmentContent)

    const range = container.querySelector('.item-card__range')
    expect(range?.textContent).toBe('[30–55]')

    const positive = container.querySelector('.item-card__delta--positive')
    expect(positive?.textContent).toBe('▲ +2')

    const negative = container.querySelector('.item-card__delta--negative')
    expect(negative?.textContent).toBe('▼ -1')
  })

  it('affix rows render the diamond marker aria-hidden + T{tier} chip + tier aria-label', () => {
    const container = mountCard(equipmentContent)

    const gem = container.querySelector('.item-card__gem')
    expect(gem?.getAttribute('aria-hidden')).toBe('true')
    expect(gem?.textContent).toBe('◆')

    expect(container.querySelector('.item-card__tier')?.textContent).toBe('T3')

    const tieredRow = container.querySelector('.item-card__row--tier-3')
    expect(tieredRow?.getAttribute('aria-label')).toBe('Bạo Kích, bậc 3: +8%')
  })

  it('renders the description as the muted footer', () => {
    const container = mountCard(equipmentContent)
    expect(container.querySelector('.item-card__description')?.textContent).toBe('Kiếm khí ngưng tụ thành hình.')
  })
})

describe('ItemCardBody - owned count rule', () => {
  it('ownedCount > 0 renders "Sở hữu: N"; 0 and absent render nothing', () => {
    const owned = mountCard({ ...gradedContent, ownedCount: 4 })
    expect(owned.textContent).toContain('Sở hữu: 4')

    const zero = mountCard({ ...gradedContent, ownedCount: 0 })
    expect(zero.textContent).not.toContain('Sở hữu')

    const absent = mountCard(gradedContent)
    expect(absent.textContent).not.toContain('Sở hữu')
  })
})

describe('Tooltip - equipment compare pair (spec section 4)', () => {
  it('renders equipped card LEFT + hovered card RIGHT, each role=group with i18n aria-label', async () => {
    mountTooltipApp()
    const owner = document.createElement('button')
    document.body.appendChild(owner)
    cleanup.push(() => owner.remove())

    const equipped: EquipmentTooltipContent = { ...equipmentContent, name: 'Địa - Hắc Thiết Kiếm' }
    useTooltip().showTooltip({ ...equipmentContent, compareWith: equipped }, owner)
    await nextTick()

    const pair = document.querySelector('.tooltip__pair')
    expect(pair).not.toBeNull()

    const groups = pair!.querySelectorAll('[role="group"]')
    expect(groups.length).toBe(2)
    expect(groups.item(0).getAttribute('aria-label')).toBe('Đang Mặc')
    expect(groups.item(1).getAttribute('aria-label')).toBe('Vật Phẩm Đang Xem')

    // Left card = the equipped counterpart; right card = the hovered one.
    expect(groups.item(0).textContent).toContain('Địa - Hắc Thiết Kiếm')
    expect(groups.item(1).textContent).toContain('Hoàng - Thanh Vân Kiếm')

    // The same i18n labels are also visible as eyebrow text.
    expect(groups.item(0).querySelector('.item-card__eyebrow')?.textContent).toBe('Đang Mặc')
    expect(groups.item(1).querySelector('.item-card__eyebrow')?.textContent).toBe('Vật Phẩm Đang Xem')
  })

  it('equipment without compareWith renders a single card - no pair, no group roles', async () => {
    mountTooltipApp()
    const owner = document.createElement('button')
    document.body.appendChild(owner)
    cleanup.push(() => owner.remove())

    useTooltip().showTooltip(equipmentContent, owner)
    await nextTick()

    expect(document.querySelector('.tooltip__pair')).toBeNull()
    expect(document.querySelector('#global-tooltip .item-card')).not.toBeNull()
    expect(document.querySelector('#global-tooltip [role="group"]')).toBeNull()
  })
})

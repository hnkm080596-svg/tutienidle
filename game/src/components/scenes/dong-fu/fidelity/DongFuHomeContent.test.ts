// @vitest-environment jsdom
//
// Plaque upgrade affordance contract (owner scope 2026-10-03, gate 1):
// a building whose model badge is 'upgrade' renders a tappable gold
// arrow ON the plaque; clicking it emits 'upgrade' with the building id
// and does NOT bubble into the plaque's own 'action'. Any other badge
// state renders no upgrade affordance at all ("an han khi khong du
// dieu kien" - no disabled ghost).
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { i18n } from '@/i18n'
import DongFuHomeContent from './DongFuHomeContent.vue'
import type { DongFuUiBuilding, DongFuUiModel } from './dongFuUi'

function makeModel(buildings: DongFuUiBuilding[]): DongFuUiModel {
  return {
    name: 'QA',
    realm: 'Pham Nhan',
    progressLabel: '0 / 60',
    progressPercent: 0,
    resources: [],
    actions: [],
    utilities: [],
    buildings,
    opportunities: [],
    quest: null,
  }
}

function makeBuilding(badge: DongFuUiBuilding['badge']): DongFuUiBuilding {
  return {
    id: 'pill_room',
    labelKey: 'panels.wheel.slots.pill_room',
    symbol: 'pill_room',
    x: 100,
    y: 100,
    badge,
  }
}

function mountContent(model: DongFuUiModel) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const emitted: { action: string[]; upgrade: string[] } = { action: [], upgrade: [] }
  const Root = defineComponent({
    render: () =>
      h(DongFuHomeContent, {
        model,
        notice: '',
        selected: null,
        wheelOpen: false,
        boardOpen: false,
        onAction: (id: string) => emitted.action.push(id),
        onUpgrade: (id: string) => emitted.upgrade.push(id),
      }),
  })
  const app = createApp({ render: () => h(Root) })
  app.use(i18n)
  app.mount(container)
  return { container, emitted, unmount: () => app.unmount() }
}

describe('DongFuHomeContent building plaque upgrade affordance', () => {
  it("badge 'upgrade' -> gold arrow button; click emits 'upgrade' only", () => {
    const mounted = mountContent(makeModel([makeBuilding('upgrade')]))
    const chip = mounted.container.querySelector<HTMLElement>('.df-building__upgrade')

    expect(chip).not.toBeNull()
    chip!.click()

    expect(mounted.emitted.upgrade).toEqual(['pill_room'])
    // stop-propagation: the plaque's own open-panel action must not fire.
    expect(mounted.emitted.action).toEqual([])

    mounted.unmount()
  })

  it("badge 'dot' (ready) -> no upgrade affordance, plaque still emits 'action'", () => {
    const mounted = mountContent(makeModel([makeBuilding('dot')]))

    expect(mounted.container.querySelector('.df-building__upgrade')).toBeNull()
    expect(mounted.container.querySelector('.df-building__dot')).not.toBeNull()

    mounted.container.querySelector<HTMLElement>('.df-building')!.click()
    expect(mounted.emitted.action).toEqual(['pill_room'])
    expect(mounted.emitted.upgrade).toEqual([])

    mounted.unmount()
  })

  it('no badge -> plaque renders bare, no upgrade affordance', () => {
    const mounted = mountContent(makeModel([makeBuilding(null)]))

    expect(mounted.container.querySelector('.df-building__upgrade')).toBeNull()
    expect(mounted.container.querySelector('.df-building__dot')).toBeNull()

    mounted.unmount()
  })
})

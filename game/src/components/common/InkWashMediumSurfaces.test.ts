/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import Tooltip from '@/components/common/Tooltip.vue'
import TechniqueSlotCard from '@/components/panels/loadout-sections/TechniqueSlotCard.vue'
import buildingPopoverSource from '@/components/game/BuildingDetailPopover.vue?raw'
import { useTooltip } from '@/composables/useTooltip'

vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    techniqueManager: { getEquipped: () => undefined },
  }),
  useStateVersion: () => ({ stateVersion: ref(0) }),
}))

const cleanup: Array<() => void> = []

afterEach(() => {
  useTooltip().dismissTooltip()
  for (const dispose of cleanup.splice(0)) dispose()
})

describe('ink-wash medium surfaces', () => {
  it('wraps the technique card with the approved M frame', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({
      render: () => h(TechniqueSlotCard, { label: 'Tâm pháp' }),
    })
    app.directive('tooltip', () => undefined)
    app.mount(container)
    cleanup.push(() => {
      app.unmount()
      container.remove()
    })

    expect(container.querySelector('[data-ink-slice="frame-m-seal-corner"]')).not.toBeNull()
  })

  it('keeps both paper surface and ink frame in the store-backed building popover', () => {
    expect(buildingPopoverSource).toContain('asset-id="surface-m-paper"')
    expect(buildingPopoverSource).toContain('asset-id="frame-m-seal-corner"')
  })

  it('renders the teleported tooltip inside the approved paper surface and ink frame', async () => {
    const owner = document.createElement('button')
    const container = document.createElement('div')
    document.body.append(owner, container)
    const app = createApp({ render: () => h(Tooltip) })
    app.mount(container)
    cleanup.push(() => {
      app.unmount()
      owner.remove()
      container.remove()
    })

    useTooltip().showTooltip({ title: 'Linh thạch', description: 'Khí tức ôn hòa.' }, owner)
    await nextTick()

    const tooltip = document.querySelector<HTMLElement>('#global-tooltip')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.querySelector('[data-ink-slice="surface-m-paper"]')).not.toBeNull()
    expect(tooltip?.querySelector('[data-ink-slice="frame-m-seal-corner"]')).not.toBeNull()
    expect(tooltip?.textContent).toContain('Linh thạch')
    expect(tooltip?.style.pointerEvents).not.toBe('auto')
  })
})

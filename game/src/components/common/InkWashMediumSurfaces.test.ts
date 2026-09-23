/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import Tooltip from '@/components/common/Tooltip.vue'
import TechniqueSlotCard from '@/components/panels/skill-path/TechniqueSlotCard.vue'
import buildingPopoverSource from '@/components/game/BuildingDetailPopover.vue?raw'
import { useTooltip } from '@/composables/useTooltip'

vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    techniqueManager: { getActive: () => undefined },
  }),
  useStateVersion: () => ({ stateVersion: ref(0) }),
}))

const cleanup: Array<() => void> = []

afterEach(() => {
  useTooltip().dismissTooltip()
  for (const dispose of cleanup.splice(0)) dispose()
})

// M-UI-OVERHAUL: the ephemeral/readout tier no longer draws ink
// nine-slice frames - these tests pin the sys chrome contract instead.
describe('system ephemeral surfaces', () => {
  it('marks the technique card as a chamfered sys widget', () => {
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

    const card = container.querySelector('.technique-card')
    expect(card?.classList.contains('sys-widget')).toBe(true)
    expect(card?.classList.contains('sys-chamfer')).toBe(true)
    expect(card?.querySelector('[data-ink-slice]')).toBeNull()
  })

  it('skins the building popover as a sys ephemeral card', () => {
    expect(buildingPopoverSource).toContain('sys-ephemeral')
    expect(buildingPopoverSource).not.toContain('InkNineSlice')
  })

  it('renders the teleported tooltip on the sys surface instead of ink frames', async () => {
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
    expect(tooltip?.querySelector('.tooltip__sys-surface')).not.toBeNull()
    expect(tooltip?.querySelector('[data-ink-slice]')).toBeNull()
    expect(tooltip?.textContent).toContain('Linh thạch')
    expect(tooltip?.style.pointerEvents).not.toBe('auto')
  })
})

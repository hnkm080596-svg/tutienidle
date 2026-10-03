/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import Tooltip from '@/components/common/Tooltip.vue'
import TechniqueSlotCard from '@/components/panels/skill-path/TechniqueSlotCard.vue'
import { useTooltip } from '@/composables/useTooltip'
import { betaTechniqueSurfaceFor } from '@/core/betaScopeTechniqueDomain'
import type { PlayerData } from '@/core/player/Player'

vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    techniqueManager: { getActive: () => undefined },
    realmAdvanceOps: {
      // Canonical-model seam - delegate to the real domain function.
      getBetaTechniqueSurfaceModel: (player: PlayerData) =>
        betaTechniqueSurfaceFor(player, {
          activeTechnique: undefined,
          materialAmount: () => 0,
          materialName: (id: string) => id,
          turnBattleInProgress: false,
        }),
    },
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
    app.use(createPinia())
    app.directive('tooltip', () => undefined)
    app.mount(container)
    cleanup.push(() => {
      app.unmount()
      container.remove()
    })

    expect(container.querySelector('[data-ink-slice="frame-m-seal-corner"]')).not.toBeNull()
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
    expect(tooltip?.querySelector('[data-hk-slice="frame-xs-tooltip"]')).not.toBeNull()
    expect(tooltip?.textContent).toContain('Linh thạch')
    expect(tooltip?.style.pointerEvents).not.toBe('auto')
  })
})

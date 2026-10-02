// @vitest-environment jsdom
/**
 * Clean Round B (consumer seam, blind review @ 5431ae7e) - mount-seam pins
 * for F-B-CONS-1 / F-B-CONS-2: a scope-hidden left-panel mode or building
 * popover must never mount even when a caller bypasses the gated store
 * actions and writes the raw ui.* fields directly. The standalone-panel
 * watcher already defends ui.standalonePanel the same way; these pins
 * bind the sibling seams to the identical chokepoint contract.
 *
 * lockBetaFeaturesForTests() pins the canonical all-false feature table
 * (the global setup unlocks everything for legacy suites).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import FunctionOverlayPanel from '@/components/layout/FunctionOverlayPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'
import {
  betaAdmittedBuildingPopoverId,
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
} from '@/core/betaScopeSurface'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

afterEach(() => {
  document.body.innerHTML = ''
})

function mountOverlay(mode: string | null) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)
  const app = createApp({ render: () => h(FunctionOverlayPanel) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  ;(useUiStore(pinia) as unknown as { leftPanelMode: string | null }).leftPanelMode = mode
  app.mount(container)
  return { container, app }
}

describe('mount seam: leftPanelMode raw write (F-B-CONS-1)', () => {
  it('the chokepoint verdicts reject the scope-hidden mode', () => {
    expect(isBetaLeftPanelMode('worker_lodge')).toBe(false)
    expect(isBetaLeftPanelMode('pill_room')).toBe(true)
  })

  it('direct worker_lodge write mounts nothing under the lock', async () => {
    const { container, app } = mountOverlay('worker_lodge')
    await Promise.resolve()

    // No overlay shell, no lodge header, no actionable panel - the raw
    // field alone can no longer reach the dormant surface.
    expect(container.querySelector('[data-testid="function-overlay-panel"]')).toBeNull()
    expect(container.querySelector('.worker-lodge-panel')).toBeNull()
    app.unmount()
    container.remove()
  })

  it('control: a beta-admitted mode still mounts', async () => {
    const { container, app } = mountOverlay('pill_room')
    await Promise.resolve()

    expect(container.querySelector('[data-testid="function-overlay-panel"]')).not.toBeNull()
    app.unmount()
    container.remove()
  })
})

describe('mount seam: activeBuildingPopoverId raw write (F-B-CONS-2)', () => {
  it('the chokepoint the popover template binds rejects chi_hien_quan', () => {
    // The GameRoot template mounts BuildingDetailPopover only through
    // betaAdmittedBuildingPopoverId - assert the seam contract directly.
    expect(betaAdmittedBuildingPopoverId('chi_hien_quan')).toBeNull()
    expect(betaAdmittedBuildingPopoverId(null)).toBeNull()
    expect(betaAdmittedBuildingPopoverId('pill_room')).toBe('pill_room')
    expect(betaAdmittedBuildingPopoverId('gathering_outpost')).toBe('gathering_outpost')
  })

  it('isBetaBuildingSurface fails closed for every scope-hidden id', () => {
    expect(isBetaBuildingSurface('chi_hien_quan')).toBe(false)
    expect(isBetaBuildingSurface('nonexistent_building')).toBe(false)
  })
})

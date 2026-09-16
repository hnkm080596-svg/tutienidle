// @vitest-environment jsdom
// B5 (audit T1-6) — the armed auto-farm holds the single StageManager
// slot, so the indicator is the player's only visible stop path. Mount
// harness per StageSelectPanel.test.ts (createApp + h + provide — no
// @vue/test-utils).
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import AutoFarmIndicator from './AutoFarmIndicator.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

function mountIndicator() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()

  const manager = {
    catalogOps: {
      // Real STAGES contain no 'farm_stage' — the fixture registers the
      // name the label assertion expects (raw-id fallback would differ
      // case-sensitively).
      getStage: (stageId: string) =>
        stageId === 'farm_stage' ? { id: 'farm_stage', name: 'Farm Stage' } : undefined,
    },
    turnBattleOps: {
      autoFarmOps: {
        // Real domain command semantics: stop clears the armed state.
        stopAutoFarm: (player: { autoFarmStage: unknown }) => {
          player.autoFarmStage = null
        },
      },
    },
  }

  const app = createApp({ render: () => h(AutoFarmIndicator) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.mount(container)

  return {
    container,
    pinia: pinia as Pinia,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('AutoFarmIndicator — B5 persistent stop control (audit T1-6)', () => {
  it('hidden when no auto-farm is armed; armed → shows stage name and stop control; stop issues the domain command', async () => {
    const mounted = mountIndicator()
    const player = usePlayerStore(mounted.pinia)

    expect(mounted.container.querySelector('.auto-farm-indicator')).toBeNull()

    player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: Date.now() }
    await nextTick()

    const indicator = mounted.container.querySelector('.auto-farm-indicator')
    expect(indicator).not.toBeNull()
    expect(indicator!.textContent).toContain('Farm Stage')

    mounted.container.querySelector<HTMLButtonElement>('[data-testid="autofarm-stop"]')!.click()
    await nextTick()

    expect(player.autoFarmStage).toBeNull()
    expect(mounted.container.querySelector('.auto-farm-indicator')).toBeNull()

    mounted.unmount()
  })
})

// @vitest-environment jsdom
// B5 (audit T1-6, migrated to live ExpeditionBattleStage in Slice 3.1) -
// the armed auto-farm holds the single StageManager slot, so the home
// ExpeditionBattleStage card is the player's visible stop path.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import ExpeditionBattleStage from './ExpeditionBattleStage.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

function mountStage() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const stateVersion = ref(0)

  const manager = {
    turnBattleOps: {
      autoFarmOps: {
        getAutoFarmView: (player: { autoFarmStage: { stageId: string } | null }) =>
          player.autoFarmStage?.stageId === 'farm_stage'
            ? {
                stageId: 'farm_stage',
                stageName: 'Farm Stage',
                cycleSeconds: 10,
                remainingSeconds: 5,
                progress: 0.5,
                enemyIds: [],
              }
            : null,
        stopAutoFarm: (player: { autoFarmStage: unknown }) => {
          player.autoFarmStage = null
        },
      },
    },
  }

  const app = createApp({ render: () => h(ExpeditionBattleStage) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
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

describe('ExpeditionBattleStage — B5 persistent stop control', () => {
  it('hidden when no auto-farm is armed; armed → shows stage name and stop control; stop issues the domain command', async () => {
    const mounted = mountStage()
    const player = usePlayerStore(mounted.pinia)

    expect(mounted.container.querySelector('[data-testid="expedition-battle-stage"]')).toBeNull()

    player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: Date.now() }
    await nextTick()

    const stage = mounted.container.querySelector('[data-testid="expedition-battle-stage"]')
    expect(stage).not.toBeNull()
    expect(stage!.textContent).toContain('Farm Stage')

    mounted.container.querySelector<HTMLButtonElement>('[data-testid="autofarm-stop"]')!.click()
    await nextTick()

    expect(player.autoFarmStage).toBeNull()
    expect(mounted.container.querySelector('[data-testid="expedition-battle-stage"]')).toBeNull()

    mounted.unmount()
  })
})

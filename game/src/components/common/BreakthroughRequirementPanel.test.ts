// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import BreakthroughRequirementPanel from './BreakthroughRequirementPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { GAME_MANAGER_KEY, BUMP_STATE_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { TECHNIQUES } from '@/data/technique/Techniques'
import type { PlayerData } from '@/core/player/Player'
import { i18n } from '@/i18n'

// Task 9.1 — panel chỉ còn xác nhận "Độ kiếp cũng là độ thân" (2 nút
// Đã hiểu / Chờ đã). Linh Thạch cost + warning cũ đã dỡ khỏi UI.
// i18n (2.5 task 8) — panel dùng t() nên assert qua i18n.global.t(key)
// thay vì raw vi string (pattern HomeResourceStrip).
function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}
function mountPanel(setup?: (manager: GameManager, player: PlayerData) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  setActivePinia(pinia)

  const manager = new GameManager()
  const player = usePlayerStore()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  setup?.(manager, player.$state)
  useBreakthroughRequirementStore().open()

  const version = ref(0)

  const app = createApp({ render: () => h(BreakthroughRequirementPanel) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  document.body.appendChild(container)
  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => { document.body.innerHTML = '' })

describe('BreakthroughRequirementPanel — confirm panel (Task 9.1)', () => {
  it('render title "Độ kiếp cũng là độ thân" + subtitle đỏ + 2 nút', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).toContain(t('tribulation.stillEquipped.title'))
    expect(container.textContent).toContain(t('tribulation.stillEquipped.subtitle'))
    expect(container.textContent).toContain(t('tribulation.stillEquipped.confirm'))
    expect(container.textContent).toContain(t('tribulation.stillEquipped.cancel'))

    unmount()
  })

  it('KHÔNG còn hiển thị Linh Thạch cost', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).not.toContain('Linh Thạch')

    unmount()
  })

  it('bấm "Đã hiểu" đóng panel (store.isOpen → false)', async () => {
    const { container, unmount } = mountPanel()

    expect(useBreakthroughRequirementStore().isOpen).toBe(true)

    const confirmButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find(button => button.textContent?.trim() === t('tribulation.stillEquipped.confirm'))!

    confirmButton.click()
    await nextTick()

    expect(useBreakthroughRequirementStore().isOpen).toBe(false)

    unmount()
  })
})

// M-F-TECHNIQUE (F-BREAK-CONFIRM) - the unperfected warning renders
// iff the live cycle's projected seal is below vien_man (FIELD
// comparison on the outcome object).
describe('BreakthroughRequirementPanel — unperfected technique warning (M-F-TECHNIQUE)', () => {
  const warnings = (container: Element) =>
    container.querySelectorAll('.breakthrough-confirm__warning')

  it('warns while the live in-band cycle would seal below vien_man', () => {
    const { container, unmount } = mountPanel((manager) => {
      manager.techniqueSystem.grant({ ...TECHNIQUES[0]! }, 'qi_refining')
      manager.techniqueManager.getActive()!.rank = 12
    })

    // rank 12 at realmLevel 12 projects dai_thanh - still unperfected.
    expect(warnings(container)).toHaveLength(2)
    expect(container.textContent).toContain(t('tribulation.unperfectedTechnique.state.dai_thanh'))

    unmount()
  })

  it('hides the warning at a rank-18 vien_man projection', () => {
    const { container, unmount } = mountPanel((manager) => {
      manager.techniqueSystem.grant({ ...TECHNIQUES[0]! }, 'qi_refining')
      manager.techniqueManager.getActive()!.rank = 18
    })

    expect(warnings(container)).toHaveLength(1)
    expect(container.textContent).not.toContain(t('tribulation.unperfectedTechnique.state.partial'))
    expect(container.textContent).not.toContain(t('tribulation.unperfectedTechnique.state.dai_thanh'))

    unmount()
  })

  it('hides the warning when no technique is held', () => {
    const { container, unmount } = mountPanel()

    expect(warnings(container)).toHaveLength(1)

    unmount()
  })

  it('warns from a sealed live-grade record verbatim (lagging holder)', () => {
    const { container, unmount } = mountPanel((manager, player) => {
      player.realmId = 'foundation_establishment'
      player.realmLevel = 5
      manager.techniqueSystem.grant({ ...TECHNIQUES[0]! }, 'qi_refining')
      const held = manager.techniqueManager.getActive()!
      held.rank = 12
      held.gradeHistory[1] = { finalRank: 12, completionState: 'dai_thanh' }
    })

    // The sealed record returns verbatim even at a new realmLevel.
    expect(warnings(container)).toHaveLength(2)
    expect(container.textContent).toContain(t('tribulation.unperfectedTechnique.state.dai_thanh'))

    unmount()
  })
})

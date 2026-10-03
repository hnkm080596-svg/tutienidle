// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import StageSelectPanel from './StageSelectPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { ENEMIES } from '@/data/enemy/Enemies'
import { buildings } from '@/data/building/buildings'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

// i18n (2.5 task 8) - assert qua i18n.global.t(key) thay vi raw vi string
// (pattern HomeResourceStrip). Ten quai/boss tu du lieu core, khong locale.
function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

function mountStageSelect() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerStages(STAGES)
  manager.catalogOps.registerZones(zones)
  manager.catalogOps.registerBuildings(buildings)
  manager.buildingManager.add({
    instanceId: 'teleport-array',
    buildingId: 'teleport_array',
    level: 1,
    lastCollectedAt: 0,
  })

  const app = createApp({ render: () => h(StageSelectPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  const ui = useUiStore(pinia)
  ui.leftPanelMode = 'stage_select'

  return { container, pinia, manager, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('StageSelectPanel — thông tin Truyền Tống Trận', () => {
  it('hiện tên quái trên tuyến ải và đội hình của stage đang chọn', async () => {
    const mounted = mountStageSelect()
    await nextTick()
    await nextTick()

    // Son Ha Do fidelity (S10): all 3 chapter bands render at once -
    // 30 nodes across the bands; nodes[9] is still mortal_dong_10
    // (band order = chapter order).
    expect(mounted.container.querySelectorAll('.stage-node')).toHaveLength(30)
    expect(mounted.container.textContent).toContain('Dã Trư')
    // BETA roster: deep-floor nodes show the band-C species.
    expect(mounted.container.textContent).toContain('Man Hổ')
    expect(mounted.container.textContent).toContain(`10 ${t('panels.stageSelect.labels.enemiesSuffix')}`)

    // Spec v3 D9 (2026-09-11): bossEnemyId only exists on floor 10 -
    // floor 1 must NOT show the Boss badge.
    expect(mounted.container.textContent).not.toContain(t('panels.stageSelect.labels.bossNamePrefix'))

    const nodes = mounted.container.querySelectorAll('.stage-node')
    ;(nodes[9] as HTMLElement).click()
    await nextTick()

    const bossStage = STAGES.find((stage) => stage.id === 'mortal_dong_10')!
    const bossTemplate = ENEMIES.find((enemy) => enemy.id === bossStage.bossEnemyId)!
    expect(mounted.container.textContent).toContain(`${t('panels.stageSelect.labels.bossNamePrefix')} ${bossTemplate.name}`)

    mounted.unmount()
  })
})

describe('StageSelectPanel — B5 auto-farm armed state + refused start guard (audit T1-6 / partial T4-38)', () => {
  it('auto-farm armed → panel shows running state + stop control; stop releases the farm', async () => {
    const { container, pinia, unmount } = mountStageSelect()
    const player = usePlayerStore(pinia)

    player.autoFarmStage = { stageId: 'mortal_dong_1', lastCheckedMs: Date.now() }
    await nextTick()

    const stopButton = container.querySelector<HTMLButtonElement>('[data-testid="autofarm-stop"]')
    expect(stopButton).not.toBeNull()

    stopButton!.click()
    await nextTick()
    expect(player.autoFarmStage).toBeNull()
    unmount()
  })

  it('perfect-farm start refused (stage slot already held) → panel stays open, farm unchanged', async () => {
    const { container, pinia, manager, unmount } = mountStageSelect()
    const player = usePlayerStore(pinia)
    const ui = useUiStore(pinia)

    player.perfectClearStageIds.push('mortal_dong_1', 'mortal_dong_2')
    // Eligibility contract (Mission B round 3): arming needs a valid
    // cycle time too - perfectClearStageIds alone is not enough.
    player.perfectClearSeconds['mortal_dong_1'] = 100
    player.perfectClearSeconds['mortal_dong_2'] = 100
    // Occupy the single stage slot with a farm on another stage.
    expect(manager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, 'mortal_dong_2')).toBe(true)
    await nextTick()

    // Select perfect_farm on the already-selected first stage, then Start.
    const farmChip = container.querySelector<HTMLElement>('.mode-chip[data-mode="perfect_farm"]')!
    farmChip.click()
    await nextTick()
    container.querySelector<HTMLButtonElement>('[data-testid="stage-start-button"]')!.click()
    await nextTick()

    expect(ui.leftPanelMode).toBe('stage_select')
    expect(player.autoFarmStage?.stageId).toBe('mortal_dong_2')
    unmount()
  })
})

// T4-38 (Mission E Task 10) - `mode` was a local ref that survived stage
// changes: arm 'repeat'/'perfect_farm' on stage A, click stage B, and the
// armed mode silently applied to B. The fix disarms to 'manual' on every
// selectedStageId change (direct click AND zone re-picks).
describe('StageSelectPanel - mode disarms on stage change (T4-38)', () => {
  it('armed mode resets to manual when a different stage node is clicked', async () => {
    const { container, pinia, unmount } = mountStageSelect()
    const player = usePlayerStore(pinia)
    player.completedStageIds = ['mortal_dong_1'] // unlock stage 2
    await nextTick()
    await nextTick()

    const chips = Array.from(container.querySelectorAll<HTMLElement>('.mode-chip'))
    expect(chips.length).toBeGreaterThanOrEqual(3)

    container.querySelector<HTMLElement>('.mode-chip[data-mode="repeat"]')!.click()
    await nextTick()
    expect(container.querySelector<HTMLElement>('.mode-chip[data-mode="repeat"]')!.classList.contains('active')).toBe(true)

    container
      .querySelector<HTMLElement>('[data-stage-id="mortal_dong_2"]')!
      .click()
    await nextTick()

    expect(container.querySelector<HTMLElement>('.mode-chip[data-mode="manual"]')!.classList.contains('active')).toBe(true)
    expect(container.querySelector<HTMLElement>('.mode-chip[data-mode="repeat"]')!.classList.contains('active')).toBe(false)

    unmount()
  })

  it('armed mode also disarms when a cross-chapter node is picked', async () => {
    const { container, unmount } = mountStageSelect()
    await nextTick()
    await nextTick()

    container.querySelector<HTMLElement>('.mode-chip[data-mode="progress"]')!.click()
    await nextTick()
    expect(container.querySelector<HTMLElement>('.mode-chip[data-mode="progress"]')!.classList.contains('active')).toBe(true)

    // Chapter-2 band node (qi_refining_forest) -> mode resets to manual.
    container.querySelector<HTMLElement>('[data-stage-id="qi_refining_forest"]')!.click()
    await nextTick()

    expect(container.querySelector<HTMLElement>('.mode-chip[data-mode="manual"]')!.classList.contains('active')).toBe(true)

    unmount()
  })
})

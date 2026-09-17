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

// i18n (2.5 task 8) — assert qua i18n.global.t(key) thay vì raw vi string
// (pattern HomeResourceStrip). Tên quái/boss từ dữ liệu core, không locale.
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

  return { container, pinia, manager, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('StageSelectPanel — thông tin Truyền Tống Trận', () => {
  it('hiện tên quái trên tuyến ải và đội hình của stage đang chọn (2026-08-30: bỏ banner ảnh dư thừa + intro text trùng lặp title bar)', async () => {
    const mounted = mountStageSelect()

    expect(mounted.container.querySelector('.stage-select__intro')).toBeNull()
    expect(mounted.container.querySelector('.stage-select__scene')).toBeNull()
    expect(mounted.container.querySelectorAll('.stage-select__filter-group--chapters button')).toHaveLength(3)
    expect(mounted.container.querySelectorAll('.stage-map__node')).toHaveLength(10)
    expect(mounted.container.textContent).toContain('Dã Trư')
    expect(mounted.container.textContent).toContain('Sơn Khấu')
    expect(mounted.container.textContent).toContain(`10 ${t('panels.stageSelect.labels.enemiesSuffix')}`)

    // Spec v3 D9 (2026-09-11): bossEnemyId only exists on floor 10 -
    // floor 1 must NOT show the Boss badge (27 nodes had a false badge).
    expect(mounted.container.textContent).not.toContain(t('panels.stageSelect.labels.bossNamePrefix'))

    const nodes = mounted.container.querySelectorAll('.stage-map__node')
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
    // cycle time too — perfectClearStageIds alone is not enough.
    player.perfectClearSeconds['mortal_dong_1'] = 100
    player.perfectClearSeconds['mortal_dong_2'] = 100
    // Occupy the single stage slot with a farm on another stage.
    expect(manager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, 'mortal_dong_2')).toBe(true)
    ui.leftPanelMode = 'stage_select'
    await nextTick()

    // Select perfect_farm on the already-selected first stage, then Start.
    // The mode row renders 4 <Chip> children in order manual/repeat/
    // progress/perfect_farm (StageSelectPanel.vue mode row).
    const farmChip = container.querySelectorAll<HTMLElement>('.stage-select__mode .chip')[3]!
    farmChip.click()
    await nextTick()
    container.querySelector<HTMLButtonElement>('[data-testid="stage-start-button"]')!.click()
    await nextTick()

    expect(ui.leftPanelMode).toBe('stage_select')
    expect(player.autoFarmStage?.stageId).toBe('mortal_dong_2')
    unmount()
  })
})

// T4-38 (Mission E Task 10) — `mode` was a local ref that survived stage
// changes: arm 'repeat'/'perfect_farm' on stage A, click stage B, and the
// armed mode silently applied to B. The fix disarms to 'manual' on every
// selectedStageId change (direct click AND zone/chapter re-picks).
describe('StageSelectPanel — mode disarms on stage change (T4-38)', () => {
  it('armed mode resets to manual when a different stage node is clicked', async () => {
    const { container, pinia, unmount } = mountStageSelect()
    const player = usePlayerStore(pinia)
    player.completedStageIds = ['mortal_dong_1'] // unlock stage 2
    await nextTick()
    await nextTick()

    const chips = Array.from(
      container.querySelectorAll<HTMLElement>('.stage-select__mode .chip'),
    )
    expect(chips.length).toBeGreaterThanOrEqual(3)

    chips[1]!.click() // arm 'repeat'
    await nextTick()
    expect(chips[1]!.classList.contains('is-active')).toBe(true)

    container
      .querySelector<HTMLElement>('[data-testid="stage-node-mortal_dong_2"]')!
      .click()
    await nextTick()

    expect(chips[0]!.classList.contains('is-active')).toBe(true)
    expect(chips[1]!.classList.contains('is-active')).toBe(false)

    unmount()
  })

  it('armed mode also disarms when a chapter change re-picks the stage', async () => {
    const { container, unmount } = mountStageSelect()
    await nextTick()
    await nextTick()

    const chips = Array.from(
      container.querySelectorAll<HTMLElement>('.stage-select__mode .chip'),
    )
    chips[2]!.click() // arm 'progress'
    await nextTick()
    expect(chips[2]!.classList.contains('is-active')).toBe(true)

    // Chapter 2 chip → selectFirstStageInChapter re-picks mortal_dong_11.
    const chapterChips = Array.from(
      container.querySelectorAll<HTMLElement>('.stage-select__filter-group--chapters .chip'),
    )
    chapterChips[1]!.click()
    await nextTick()
    await nextTick()

    expect(chips[0]!.classList.contains('is-active')).toBe(true)

    unmount()
  })
})

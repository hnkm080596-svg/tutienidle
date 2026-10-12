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
    const bossPlayer = usePlayerStore(mounted.pinia)
    // Locked nodes no longer select: the boss floor must be genuinely
    // unlocked for its detail to render - floor N needs realmLevel >= N
    // plus the previous floor completed (isStageUnlocked).
    bossPlayer.realmLevel = 10
    bossPlayer.completedStageIds = [
      'mortal_dong_1',
      'mortal_dong_2',
      'mortal_dong_3',
      'mortal_dong_4',
      'mortal_dong_5',
      'mortal_dong_6',
      'mortal_dong_7',
      'mortal_dong_8',
      'mortal_dong_9',
    ]
    await nextTick()
    await nextTick()

    // Thanh Van map (2026-10-11): ONE vista shows all 30 ai across the
    // 3 chapters; the mortal chapter occupies the first 10 nodes, so
    // nodes[9] is still mortal_dong_10.
    expect(mounted.container.querySelectorAll('.stage-node')).toHaveLength(30)
    // Minh 2026-10-12: node enemy name tags removed from the vista and
    // the inspector no longer carries enemy intel at all.
    expect(mounted.container.querySelectorAll('.node-enemy')).toHaveLength(0)
    expect(mounted.container.textContent).not.toContain('Heo Rừng')
    const nodes = mounted.container.querySelectorAll('.stage-node')

    // Frontier pick (2026-10-11): the surface anchors on the first
    // uncleared ai - dong_10 here. Minh 2026-10-12: the inspector head
    // identifies the ai by its global 1-30 index (Ai 1-10 label).
    expect(mounted.container.textContent).toContain('Ải 1-10')

    // Spec v3 D9 (2026-09-11): bossEnemyId only exists on floor 10 -
    // picking floor 1 swaps the detail to that ai.
    ;(nodes[0] as HTMLElement).click()
    await nextTick()
    expect(mounted.container.textContent).toContain('Ải 1-1')
    // Enemy intel no longer renders in the inspector (Minh 2026-10-12).
    expect(mounted.container.querySelector('.enemy-summary')).toBeNull()
    expect(mounted.container.querySelector('.enemy-name')).toBeNull()

    mounted.unmount()
  })
})

describe('StageSelectPanel — B5 auto-farm armed state + refused start guard (audit T1-6 / partial T4-38)', () => {
  it('auto-farm armed → panel shows no in-card stop row (stop lives in DongFuStage AutoFarmIndicator)', async () => {
    // Minh 2026-10-12: the inspector's armed-farm banner was removed;
    // stopping the farm is the home-chrome indicator's job, covered by
    // AutoFarmIndicator.test.ts.
    const { container, pinia, unmount } = mountStageSelect()
    const player = usePlayerStore(pinia)

    player.autoFarmStage = { stageId: 'mortal_dong_1', lastCheckedMs: Date.now() }
    await nextTick()

    expect(container.querySelector('[data-testid="autofarm-stop"]')).toBeNull()
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
    // Modes live in the dropdown now - open it, then pick the option.
    container.querySelector<HTMLElement>('.mode-toggle')!.click()
    await nextTick()
    const farmChip = container.querySelector<HTMLElement>('.mode-option[data-mode="perfect_farm"]')!
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
    player.completedStageIds = ['mortal_dong_1'] // chain requirement
    player.realmLevel = 2 // floor 2 needs realmLevel >= 2 to unlock
    await nextTick()
    await nextTick()

    // Modes live in the dropdown now - open it, then pick the option.
    container.querySelector<HTMLElement>('.mode-toggle')!.click()
    await nextTick()
    const chips = Array.from(container.querySelectorAll<HTMLElement>('.mode-option'))
    expect(chips.length).toBeGreaterThanOrEqual(3)

    container.querySelector<HTMLElement>('.mode-option[data-mode="repeat"]')!.click()
    await nextTick()
    container.querySelector<HTMLElement>('.mode-toggle')!.click()
    await nextTick()
    expect(container.querySelector<HTMLElement>('.mode-option[data-mode="repeat"]')!.classList.contains('active')).toBe(true)

    // Frontier pick anchors on dong_2 at open (first uncleared) - so
    // the disarm check must click a DIFFERENT node: back to dong_1.
    container
      .querySelector<HTMLElement>('[data-stage-id="mortal_dong_1"]')!
      .click()
    await nextTick()

    expect(container.querySelector<HTMLElement>('.mode-option[data-mode="manual"]')!.classList.contains('active')).toBe(true)
    expect(container.querySelector<HTMLElement>('.mode-option[data-mode="repeat"]')!.classList.contains('active')).toBe(false)

    unmount()
  })

  it('armed mode also disarms when a cross-chapter node is picked', async () => {
    const { container, pinia, unmount } = mountStageSelect()
    const crossPlayer = usePlayerStore(pinia)
    // qi_refining_forest unlocks when the previous floor (mortal_dong_10)
    // is completed and the player is in qi_refining realm level >= 1.
    crossPlayer.realmId = 'qi_refining'
    crossPlayer.realmLevel = 1
    crossPlayer.completedStageIds = ['mortal_dong_10']
    await nextTick()
    await nextTick()

    container.querySelector<HTMLElement>('.mode-toggle')!.click()
    await nextTick()
    container.querySelector<HTMLElement>('.mode-option[data-mode="progress"]')!.click()
    await nextTick()
    container.querySelector<HTMLElement>('.mode-toggle')!.click()
    await nextTick()
    expect(container.querySelector<HTMLElement>('.mode-option[data-mode="progress"]')!.classList.contains('active')).toBe(true)

    // Cross-chapter pick now goes straight through the single-vista
    // map - tapping the first qi_refining node (qi_refining_forest,
    // unlocked by mortal_dong_10) changes the selection and disarms.
    container.querySelector<HTMLElement>('[data-stage-id="qi_refining_forest"]')!.click()
    await nextTick()

    // jsdom click() emits no pointerdown, so the list stays open after
    // the node pick - assert directly without re-toggling.
    expect(container.querySelector<HTMLElement>('.mode-option[data-mode="manual"]')!.classList.contains('active')).toBe(true)

    unmount()
  })
})

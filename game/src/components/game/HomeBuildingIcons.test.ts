// @vitest-environment jsdom
//
// Workstream C (dong-fu plan) — hotspot là MỘT trong HAI entry point
// (entry kia = command wheel ring 3); cả hai đi qua
// composables/useBuildingNavigation.ts và popover DÙNG CHUNG được render
// ở tầng GameRoot (ui.activeBuildingPopoverId). Test mount cùng lúc
// hotspot layer + popover authority stub y hệt GameRoot.
//
// Building đã xây mở LeftPanel; nút nâng cấp sống trong header panel,
// không còn chip nổi trên world hotspot.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import HomeBuildingIcons from './HomeBuildingIcons.vue'
import BuildingDetailPopover from './BuildingDetailPopover.vue'
import { GameManager } from '@/core/game/GameManager'
import type { Building } from '@/core/building/Building'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { useUiStore } from '@/stores/ui'
import type { Material } from '@/core/material/Material'

const PILL_ROOM_DEF: Building = {
  id: 'pill_room',
  name: 'Đan Phòng',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 3,
  baseStorageCapacity: 0,
  upgradeCost: [
    [{ materialId: 'go_linh_moc', amount: 5 }],
    [{ materialId: 'go_linh_moc', amount: 10 }],
    [{ materialId: 'go_linh_moc', amount: 20 }],
  ],
  functionType: 'pill_room',
}

const UPGRADE_MATERIAL: Material = {
  id: 'go_linh_moc',
  name: 'Gỗ Linh Mộc',
  category: 'wood',
  sourceType: 'building',
}

function mountHomeBuildings(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  // Stub tầng GameRoot: hotspot layer + shared popover authority.
  const RootStub = defineComponent({
    setup() {
      const ui = useUiStore()

      return () =>
        h('div', [
          h(HomeBuildingIcons),
          ui.activeBuildingPopoverId
            ? h(BuildingDetailPopover, {
                buildingId: ui.activeBuildingPopoverId,
                onClose: () => ui.closeBuildingPopover(),
              })
            : null,
        ])
    },
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })

  app.directive('tooltip', vTooltip)

  app.mount(container)

  return {
    upgradeChips: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button.building-hotspot__upgrade')),

    buildingButtons: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.building-hotspot')),

    buildingButton: (buildingId: string) =>
      container.querySelector<HTMLButtonElement>(`[data-building-id="${buildingId}"] .building-hotspot`),

    scriptureButton: () =>
      container.querySelector<HTMLButtonElement>('[data-building-id="scripture_pavilion"]'),

    container,

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

let gameManager: GameManager

beforeEach(() => {
  gameManager = new GameManager()

  gameManager.registerMaterials([UPGRADE_MATERIAL])
  gameManager.registerBuildings([PILL_ROOM_DEF])
})

afterEach(() => {
  window.localStorage.removeItem('dev.testModeUnlockAll')
})

describe('HomeBuildingIcons — building navigation không dùng chip nổi', () => {
  it('chưa xây → KHÔNG có chip (popover xây mới mở qua click chính)', () => {
    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.upgradeChips()).toHaveLength(0)
    expect(mounted.buildingButtons().length).toBeGreaterThan(0)

    mounted.unmount()
  })

  it('đã xây chưa max → không còn chip nổi; click hotspot mở LeftPanel', async () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_1',

      buildingId: 'pill_room',

      level: 1,

      lastCollectedAt: 0,
    })

    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.upgradeChips()).toHaveLength(0)

    mounted.buildingButton('pill_room')!.click()

    await nextTick()

    const ui = useUiStore()

    expect(ui.leftPanelMode).toBe('pill_room')
    expect(ui.activeBuildingPopoverId).toBeNull()

    mounted.unmount()
  })

  it('đã xây ĐẠT max → không còn chip', () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_max',

      buildingId: 'pill_room',

      level: 3,

      lastCollectedAt: 0,
    })

    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.upgradeChips()).toHaveLength(0)

    mounted.unmount()
  })

  it('Tàng Kinh Các KHÔNG còn là hotspot/pseudo-building', () => {
    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.scriptureButton()).toBeNull()
    expect(mounted.container.querySelector('[data-building-id="scripture_pavilion"]')).toBeNull()

    mounted.unmount()
  })

  it('chưa xây → click hotspot → popover Xây dựng → mở khóa building thật', async () => {
    window.localStorage.setItem('dev.testModeUnlockAll', '1')

    const mounted = mountHomeBuildings(gameManager)
    const hotspot = mounted.buildingButton('pill_room')

    expect(hotspot).not.toBeNull()
    hotspot!.click()
    await nextTick()
    await nextTick()

    const buildButton = mounted.container.querySelector<HTMLButtonElement>('.building-popover__action')

    expect(buildButton).not.toBeNull()
    expect(buildButton!.disabled).toBe(false)

    buildButton!.click()
    await nextTick()
    await nextTick()

    expect(gameManager.buildingManager.getByBuildingId('pill_room')).toBeDefined()

    const ui = useUiStore()

    expect(ui.leftPanelMode).toBe('pill_room')
    expect(ui.activeBuildingPopoverId).toBeNull()

    mounted.unmount()
  })

  it('đã xây + có functionType → click hotspot mở PANEL chức năng (không popover)', async () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_fn',

      buildingId: 'pill_room',

      level: 1,

      lastCollectedAt: 0,
    })

    const mounted = mountHomeBuildings(gameManager)
    const hotspot = mounted.buildingButton('pill_room')

    hotspot!.click()
    await nextTick()

    const ui = useUiStore()

    expect(ui.leftPanelMode).toBe('pill_room')
    expect(ui.activeBuildingPopoverId).toBeNull()

    mounted.unmount()
  })

  it('Linh Tuyền đã xây mở LeftPanel thay vì popover trung tâm', async () => {
    const springManager = new GameManager()

    springManager.registerBuildings([{
      id: 'spirit_spring',
      name: 'Linh Tuyền',
      category: 'resource',
      tier: 1,
      maxLevel: 3,
      baseStorageCapacity: 60,
      baseProductionRate: 1,
      producesMaterialId: 'spirit_stone',
      upgradeCost: [[], [], []],
      functionType: 'spirit_spring',
    }])
    springManager.buildingManager.add({
      instanceId: 'inst_spring',
      buildingId: 'spirit_spring',
      level: 1,
      lastCollectedAt: Date.now() / 1000,
    })

    const mounted = mountHomeBuildings(springManager)

    mounted.buildingButton('spirit_spring')!.click()
    await nextTick()

    const ui = useUiStore()

    expect(ui.leftPanelMode).toBe('spirit_spring')
    expect(ui.activeBuildingPopoverId).toBeNull()

    mounted.unmount()
  })
})

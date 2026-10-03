// @vitest-environment jsdom
//
// Workstream C (dong-fu plan) - hotspot la MOT trong HAI entry point
// (entry kia = command wheel ring 3); ca hai di qua
// composables/useBuildingNavigation.ts.
//
// Building da xay mo LeftPanel; nut nang cap song trong header panel,
// khong con chip noi tren world hotspot.
import { beforeEach, describe, expect, it } from 'vitest'
import { computed, nextTick } from 'vue'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import HomeBuildingIcons from './HomeBuildingIcons.vue'
import { GameManager } from '@/core/game/GameManager'
import type { Building } from '@/core/building/Building'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { useUiStore } from '@/stores/ui'
import type { Material } from '@/core/material/Material'
import { buildings as gameBuildings } from '@/data/building/buildings'
import type { ThanhVanVariant } from '@/game/support/ThanhVanArt'

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

function mountHomeBuildings(
  gameManager: GameManager,
  initialVariant: ThanhVanVariant = { season: 'spring', time: 'morning' },
) {
  const container = document.createElement('div')
  const stateVersion = ref(0)
  const renderedVariant = ref(initialVariant)

  document.body.appendChild(container)

  const app = createApp({
    render: () => h(HomeBuildingIcons, { variant: renderedVariant.value }),
  })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })
  // Route-driven visibility (R12): stageActive derives from the
  // coordinator route; provide a 'home' stub so mounted components can
  // resolve it.
  app.provide(VUE_ROUTE_ADAPTER_KEY, {
    activeRoute: computed(() => 'home' as Route),
  } as unknown as VueRouteAdapter)

  app.directive('tooltip', vTooltip)

  app.mount(container)

  return {
    upgradeChips: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button.building-hotspot__upgrade')),

    buildingButtons: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.building-hotspot')),

    buildingAnchors: () =>
      Array.from(container.querySelectorAll<HTMLElement>('.building-hotspot-anchor')),

    buildingButton: (buildingId: string) =>
      container.querySelector<HTMLButtonElement>(`[data-building-id="${buildingId}"] .building-hotspot`),

    nameplate: (buildingId: string) =>
      container.querySelector<HTMLElement>(`[data-building-id="${buildingId}"] .building-nameplate`),

    sprite: (buildingId: string) =>
      container.querySelector<HTMLElement>(`[data-building-id="${buildingId}"] .dong-fu-building-sprite`),

    seasonOverlay: () =>
      container.querySelector<HTMLImageElement>('.home-building-hotspots__season-overlay'),

    bump: async () => {
      stateVersion.value += 1
      await nextTick()
    },

    setVariant: async (nextVariant: ThanhVanVariant) => {
      renderedVariant.value = nextVariant
      await nextTick()
    },

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

  gameManager.catalogOps.registerMaterials([UPGRADE_MATERIAL])
  gameManager.catalogOps.registerBuildings(
    gameBuildings.map((building) => building.id === PILL_ROOM_DEF.id ? PILL_ROOM_DEF : building),
  )
})

describe('HomeBuildingIcons — building navigation không dùng chip nổi', () => {
  it('renders six manifest-ordered building sprites and one shared season overlay', () => {
    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.buildingAnchors().map((node) => node.dataset.buildingId)).toEqual([
      'pill_room',
      'gathering_outpost',
      'teleport_array',
      'equipment_hall',
      'vendor',
      'chi_hien_quan',
    ])
    expect(mounted.sprite('pill_room')).not.toBeNull()
    expect(mounted.sprite('pill_room')!.classList).toContain('is-locked')
    expect(mounted.buildingAnchors()[0]!.style.getPropertyValue('--baseline-offset')).toBe(
      '-82.29665071770334%',
    )
    expect(mounted.buildingButton('pill_room')!.getAttribute('aria-label')).toContain('Đan Phòng')
    expect(mounted.seasonOverlay()?.getAttribute('src')).toBe(
      '/assets/buildings/dong-fu/v2/shared/seasons/spring.png',
    )

    mounted.unmount()
  })

  it('keeps button and nameplate available when a sprite asset fails', async () => {
    const mounted = mountHomeBuildings(gameManager)
    const base = mounted.sprite('pill_room')!.querySelector<HTMLImageElement>('[data-layer="base"]')!

    base.dispatchEvent(new Event('error'))
    await nextTick()

    expect(mounted.sprite('pill_room')!.classList).toContain('has-asset-error')
    expect(mounted.buildingButton('pill_room')).not.toBeNull()
    expect(mounted.nameplate('pill_room')?.textContent).toContain('Đan Phòng')

    mounted.unmount()
  })

  it('updates building grading from the rendered background variant prop', async () => {
    const mounted = mountHomeBuildings(gameManager)

    await mounted.setVariant({ season: 'winter', time: 'night' })

    expect(mounted.seasonOverlay()?.getAttribute('src')).toBe(
      '/assets/buildings/dong-fu/v2/shared/seasons/winter.png',
    )
    expect(mounted.sprite('pill_room')!.classList).toContain('is-time-night')

    mounted.unmount()
  })

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

  it('đã xây + có functionType → click hotspot mở PANEL chức năng', async () => {
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

    mounted.unmount()
  })

  it('Linh Tuyền đã xây mở LeftPanel thay vì popover trung tâm', async () => {
    const springManager = new GameManager()

    springManager.catalogOps.registerBuildings([{
      id: 'chi_hien_quan',
      name: 'Linh Tuyền',
      category: 'resource',
      tier: 1,
      maxLevel: 3,
      baseStorageCapacity: 60,
      baseProductionRate: 1,
      producesMaterialId: 'spirit_stone',
      upgradeCost: [[], [], []],
      functionType: 'worker_lodge',
    }])
    springManager.buildingManager.add({
      instanceId: 'inst_spring',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: Date.now() / 1000,
    })

    const mounted = mountHomeBuildings(springManager)

    mounted.buildingButton('chi_hien_quan')!.click()
    await nextTick()

    const ui = useUiStore()

    expect(ui.leftPanelMode).toBe('worker_lodge')

    mounted.unmount()
  })
})

describe('HomeBuildingIcons — nameplate + badge trạng thái (plan §3.1)', () => {
  it('uses the approved Khai Vật Đường display name for gathering_outpost', () => {
    const mounted = mountHomeBuildings(gameManager)

    expect(mounted.nameplate('gathering_outpost')?.textContent).toContain('Khai Vật Đường')

    mounted.unmount()
  })

  it('nameplate hiển thị đúng tên building từ template', () => {
    const mounted = mountHomeBuildings(gameManager)

    const nameplate = mounted.nameplate('pill_room')

    expect(nameplate).not.toBeNull()
    expect(nameplate!.textContent).toContain('Đan Phòng')

    mounted.unmount()
  })

  it('chưa xây → badge locked (icon khóa + nameplate mờ)', () => {
    const mounted = mountHomeBuildings(gameManager)

    const nameplate = mounted.nameplate('pill_room')!

    expect(nameplate.classList.contains('building-nameplate--locked')).toBe(true)
    expect(nameplate.querySelector('.building-nameplate__lock')).not.toBeNull()

    mounted.unmount()
  })

  it('đã xây + đủ nguyên liệu nâng cấp → badge upgradeable (chấm sáng)', () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_upgrade',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })

    // upgradeCost[1] = 10 Go Linh Moc - cap du nguyen lieu.
    gameManager.materialBag.add(UPGRADE_MATERIAL, 10)

    const mounted = mountHomeBuildings(gameManager)

    const nameplate = mounted.nameplate('pill_room')!

    expect(nameplate.classList.contains('building-nameplate--upgradeable')).toBe(true)
    expect(nameplate.querySelector('.building-nameplate__upgradeable')).not.toBeNull()

    mounted.unmount()
  })

  it('đã xây + thiếu nguyên liệu → chỉ nameplate, không badge', () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_plain',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })

    const mounted = mountHomeBuildings(gameManager)

    const nameplate = mounted.nameplate('pill_room')!

    expect(nameplate.classList.contains('building-nameplate--default')).toBe(true)

    mounted.unmount()
  })

  // T4-31 - presentationFor/statusFor read no reactive source, so badges
  // and nameplates froze at first render. After the fix they track
  // stateVersion: a build landing after mount must flip the badge.
  it('badge flips locked -> built after a building materializes + bumpState', async () => {
    const mounted = mountHomeBuildings(gameManager)

    const nameplate = mounted.nameplate('pill_room')!
    expect(nameplate.classList.contains('building-nameplate--locked')).toBe(true)

    gameManager.buildingManager.add({
      instanceId: 'inst_pill_late',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    await mounted.bump()

    expect(nameplate.classList.contains('building-nameplate--locked')).toBe(false)
    expect(nameplate.classList.contains('building-nameplate--default')).toBe(true)
    expect(nameplate.textContent).toContain('Cấp 1')

    mounted.unmount()
  })

  it('badge flips to upgradeable when upgrade materials arrive + bumpState', async () => {
    gameManager.buildingManager.add({
      instanceId: 'inst_pill_late_up',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })

    const mounted = mountHomeBuildings(gameManager)
    const nameplate = mounted.nameplate('pill_room')!
    expect(nameplate.classList.contains('building-nameplate--upgradeable')).toBe(false)

    gameManager.materialBag.add(UPGRADE_MATERIAL, 10)
    await mounted.bump()

    expect(nameplate.classList.contains('building-nameplate--upgradeable')).toBe(true)

    mounted.unmount()
  })

  it('Linh Tuyền có sản lượng claim được → badge ready', () => {
    const springManager = new GameManager()

    springManager.catalogOps.registerMaterials([UPGRADE_MATERIAL])
    springManager.catalogOps.registerBuildings([{
      id: 'chi_hien_quan',
      name: 'Linh Tuyền',
      category: 'resource',
      tier: 1,
      maxLevel: 3,
      baseStorageCapacity: 60,
      baseProductionRate: 1,
      producesMaterialId: 'spirit_stone',
      upgradeCost: [[], [], []],
      functionType: 'worker_lodge',
    }])
    springManager.buildingManager.add({
      instanceId: 'inst_spring',
      buildingId: 'chi_hien_quan',
      level: 1,
      // lastCollectedAt lui sau vao qua khu -> stored >= 1.
      lastCollectedAt: Date.now() / 1000 - 3600,
    })

    const mounted = mountHomeBuildings(springManager)

    const nameplate = mounted.nameplate('chi_hien_quan')!

    expect(nameplate.classList.contains('building-nameplate--ready')).toBe(true)
    expect(nameplate.querySelector('.building-nameplate__ready')).not.toBeNull()

    mounted.unmount()
  })
})

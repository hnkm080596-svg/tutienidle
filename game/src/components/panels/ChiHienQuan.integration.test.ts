// @vitest-environment jsdom
// T6 gap-2 (chi-hien-quan, 2026-09-02) — integration smoke thay manual
// browser probe (browser probe treo với môi trường agent; oracle DOM
// qua mount Vue thật + GameManager thật — cùng cấu trúc render).
//
// Chứng minh chuỗi người chơi cần thấy:
// 1. WorkerLodgePanel render capacity từ CHQ instance (1+level×2)
// 2. ProductionPanel: worker allocation block (auto/manual toggle +
//    slider → assignWorkers → state persist qua bumpState)
// 3. Linh mạch card render khi outpost ĐÃ xây (sau xóa spirit_spring)
//    + collect gọi collectBuilding
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import ProductionPanel from './ProductionPanel.vue'
import WorkerLodgePanel from './WorkerLodgePanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { COMPANIONS } from '@/data/companion/Companions'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

const WOOD = { id: 'test_wood', name: 'Linh Mộc Test', category: 'wood' as const, sourceType: 'building' as const }

function makeDeps(panel: unknown) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)
  gameManager.catalogOps.registerMaterials([WOOD])
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.materialBag.add(WOOD, 999)

  const app = createApp({ render: () => h(panel as never) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  return { container, app, pinia, gameManager }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CHQ integration smoke — DOM oracle thay browser probe', () => {
  it('WorkerLodgePanel: capacity 3 ở cấp 1 — panel text render', () => {
    const deps = makeDeps(WorkerLodgePanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'chq_inst',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!

    deps.gameManager.buildingOps.refreshAutoWorkerCapacity(player.$state, chq)

    const text = deps.container.textContent ?? ''

    expect(text).toContain('Nhân công')
    expect(text).toContain('3')

    deps.app.unmount()
  })

  it('ProductionPanel: allocation block + linh mạch + assignWorkers persist', async () => {
    const deps = makeDeps(ProductionPanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst',
      buildingId: 'gathering_outpost',
      level: 1,
      lastCollectedAt: 0,
    })

    deps.gameManager.buildingManager.add({
      instanceId: 'chq_inst',
      buildingId: 'chi_hien_quan',
      level: 2,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!

    deps.gameManager.buildingOps.refreshAutoWorkerCapacity(player.$state, chq)

    await nextTick()

    const text = deps.container.textContent ?? ''

    // Allocation header + mode labels render.
    expect(text).toContain('Nhân công:')
    expect(text).toContain('Tự động')
    expect(text).toContain('Phân thủ công')

    // Workers-as-fuel (spec D3): no Start-cycle control exists; the panel
    // is pure worker allocation + auto-repeat gating.
    expect(deps.container.querySelector('.site-card__action')).toBeNull()

    // Linh mạch card render (outpost đã xây — sau khi xóa spirit_spring).
    expect(text).toContain('Linh Mạch')

    // Manual: assign qua GameManager (như handler slider) → state persist.
    const siteId = deps.gameManager.buildingOps.getProductionViews(Date.now())[0]!.definition.siteId

    deps.gameManager.buildingOps.assignWorkers(siteId, 2)

    expect(deps.gameManager.productionSystem.getState(siteId)?.assignedWorkers).toBe(2)

    // Quay auto: undefined.
    deps.gameManager.buildingOps.assignWorkers(siteId, undefined)

    expect(deps.gameManager.productionSystem.getState(siteId)?.assignedWorkers).toBeUndefined()

    deps.app.unmount()
  })

  it('ProductionPanel: workerMode derives from persisted assignments (no local ref); slider max = available pool', async () => {
    const deps = makeDeps(ProductionPanel)
    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0,
    })
    deps.gameManager.buildingManager.add({
      instanceId: 'chq_inst', buildingId: 'chi_hien_quan', level: 2, lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)
    player.realmId = 'mortal'
    deps.gameManager.setActivePlayer(player.$state)
    const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!
    deps.gameManager.buildingOps.refreshAutoWorkerCapacity(player.$state, chq) // total 5

    // Decompose holds 2 of the 5 -> production sliders max at 3.
    deps.gameManager.decomposeSystem.updateCapacity(5)
    deps.gameManager.decomposeSystem.setSetting({ workers: 2 })

    // A persisted assignment exists BEFORE mount -> the panel must derive
    // 'manual' from it (audit T4-29: the old local ref always reset to auto).
    const siteId = deps.gameManager.buildingOps.getProductionViews(Date.now())[0]!.definition.siteId
    deps.gameManager.buildingOps.assignWorkers(siteId, 2)

    deps.app.mount(deps.container)
    await nextTick()

    const radios = deps.container.querySelectorAll<HTMLInputElement>('input[name="worker-mode"]')
    expect(radios[0]!.checked).toBe(false) // auto
    expect(radios[1]!.checked).toBe(true)  // manual

    const slider = deps.container.querySelector<HTMLInputElement>('.worker-allocation__slider input[type=range]')
    expect(slider).not.toBeNull()
    expect(slider!.max).toBe('3') // available = 5 - 2, not the total 5

    deps.app.unmount()
  })

  it('ProductionPanel: mount không crash với outpost instance (linh mạch card)', async () => {
    const deps = makeDeps(ProductionPanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst',
      buildingId: 'gathering_outpost',
      level: 1,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    await nextTick()

    expect(deps.container.textContent ?? '').toContain('Linh Mạch')

    deps.app.unmount()
  })
})

// =========================
// companion-gacha Task 9 (2026-09-12) - Chieu Hien Quan gacha tabs:
// nhan_cong (original body) / chieu_mo (token pull) / duyen_phan
// (Duyen Phan exchange). Mounted through the real WorkerLodgePanel so
// the TabBar wiring is covered too.
// =========================

const PULL_TOKEN = materials.find((material) => material.id === 'chieu_hien_lenh')!

function mountWorkerLodge(prepare?: (deps: ReturnType<typeof makeDeps> & { player: ReturnType<typeof usePlayerStore> }) => void) {
  const deps = makeDeps(WorkerLodgePanel)

  // Real material catalog so the Chieu Hien Lenh registry entry resolves
  // (token name label) and the v-tooltip directive used by DuyenPhanTab
  // registers like production (main.ts).
  deps.gameManager.catalogOps.registerMaterials(materials)
  deps.app.directive('tooltip', vTooltip)

  const player = usePlayerStore(deps.pinia)

  player.realmId = 'mortal'
  deps.gameManager.setActivePlayer(player.$state)

  // Panel computeds cache on stateVersion - any state the first render
  // must see (building instances, bag contents) has to exist BEFORE
  // mount; player store fields are Pinia-reactive so they can change
  // at any time.
  prepare?.({ ...deps, player })

  deps.app.mount(deps.container)

  return { ...deps, player }
}

async function openTab(container: HTMLElement, index: number) {
  const tabs = container.querySelectorAll<HTMLButtonElement>('.worker-lodge-panel__tabs button')

  tabs[index]!.click()

  await nextTick()
}

function pullButton(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('.chieu-mo__pull')
}

function exchangeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('.duyen-phan__exchange'))
}

describe('CHQ gacha tabs (companion-gacha Task 9)', () => {
  it('tab bar renders nhan_cong / chieu_mo / duyen_phan; default tab keeps worker capacity body', async () => {
    const deps = mountWorkerLodge((prepared) => {
      prepared.gameManager.buildingManager.add({
        instanceId: 'chq_inst',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: 0,
      })
    })

    await nextTick()

    const tabs = Array.from(
      deps.container.querySelectorAll<HTMLButtonElement>('.worker-lodge-panel__tabs button'),
    ).map((tab) => tab.textContent?.trim())

    expect(tabs).toEqual(['Nhân Công', 'Chiêu Mộ', 'Đổi Duyên Phận'])

    const text = deps.container.textContent ?? ''

    expect(text).toContain('Nhân công')
    expect(text).toContain('3')

    deps.app.unmount()
  })

  it('chieu_mo tab: pull button disabled without a Chieu Hien Lenh token', async () => {
    const deps = mountWorkerLodge()

    await openTab(deps.container, 1)

    const button = pullButton(deps.container)

    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(true)

    deps.app.unmount()
  })

  it('chieu_mo tab: pity counter renders player.companionPullsSinceRare', async () => {
    const deps = mountWorkerLodge()

    deps.player.companionPullsSinceRare = 12

    await openTab(deps.container, 1)

    expect(deps.container.textContent ?? '').toContain('12/30')

    deps.app.unmount()
  })

  it('chieu_mo tab: duplicate pull renders reveal card with constellationRankAfter', async () => {
    const deps = mountWorkerLodge()

    // Owning every definition in the pool makes any roll a duplicate -
    // deterministic constellation_up at rank 1 without mocking random.
    deps.player.companions = COMPANIONS.map((definition) => ({
      instanceId: `inst_${definition.id}`,
      definitionId: definition.id,
      realmId: 'mortal',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    }))

    deps.gameManager.materialBag.add(PULL_TOKEN, 1)

    await openTab(deps.container, 1)

    const button = pullButton(deps.container)!

    expect(button.disabled).toBe(false)

    button.click()
    await nextTick()

    const result = deps.container.querySelector('.chieu-mo__result')

    expect(result).not.toBeNull()
    // "Trung -> Cung Menh +1 (C1)" via chieuMo.result.constellationUp.
    expect(result!.textContent ?? '').toContain('C1')

    // Ops layer side effects: token spent, +1 Duyen Phan, pity counter.
    expect(deps.gameManager.materialBag.getAmount('chieu_hien_lenh')).toBe(0)
    expect(deps.player.duyenPhan).toBe(1)
    expect(deps.player.companionPullsSinceRare).toBe(1)

    deps.app.unmount()
  })

  it('duyen_phan tab: exchange button disabled when Duyen Phan is short', async () => {
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 0

    await openTab(deps.container, 2)

    const buttons = exchangeButtons(deps.container)

    expect(buttons.length).toBe(COMPANIONS.length)
    expect(buttons.every((button) => button.disabled)).toBe(true)

    deps.app.unmount()
  })

  it('duyen_phan tab: constellation-maxed companion stays disabled even with enough points', async () => {
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 1000
    deps.player.companions = [
      {
        instanceId: 'inst_maxed',
        definitionId: COMPANIONS[0]!.id,
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 6,
      },
    ]

    await openTab(deps.container, 2)

    const rows = Array.from(deps.container.querySelectorAll<HTMLElement>('.duyen-phan__row'))

    expect(rows.length).toBe(COMPANIONS.length)

    const maxedRow = rows[0]!
    const maxedButton = maxedRow.querySelector<HTMLButtonElement>('.duyen-phan__exchange')!

    // Row carries the C6 badge + maxed reason text; button stays off.
    expect(maxedRow.textContent ?? '').toContain('C6')
    expect(maxedButton.disabled).toBe(true)

    // A non-owned row stays enabled at the same duyenPhan balance.
    const otherButton = rows[1]!.querySelector<HTMLButtonElement>('.duyen-phan__exchange')!

    expect(otherButton.disabled).toBe(false)

    deps.app.unmount()
  })

  it('duyen_phan tab: exchange spends Duyen Phan and grants the companion', async () => {
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 20

    await openTab(deps.container, 2)

    const button = exchangeButtons(deps.container)[0]!

    expect(button.disabled).toBe(false)

    button.click()
    await nextTick()

    expect(deps.player.duyenPhan).toBe(0)
    expect(deps.player.companions.some((instance) => instance.definitionId === COMPANIONS[0]!.id)).toBe(
      true,
    )

    deps.app.unmount()
  })
})

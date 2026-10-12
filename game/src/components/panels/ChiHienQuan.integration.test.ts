// @vitest-environment jsdom
// T6 gap-2 (chi-hien-quan, 2026-09-02) - integration smoke thay manual
// browser probe (browser probe treo voi moi truong agent; oracle DOM
// qua mount Vue that + GameManager that - cung cau truc render).
//
// Chung minh chuoi nguoi choi can thay:
// 1. WorkerLodgePanel render capacity tu CHQ instance (1+levelx2)
// 2. ProductionPanel: worker allocation block (auto/manual toggle +
//    slider -> assignWorkers -> state persist qua bumpState)
// 3. Linh mach card render khi outpost DA xay (sau xoa spirit_spring)
//    + collect goi collectBuilding
import { afterEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import ProductionPanel from './ProductionPanel.vue'
import WorkerLodgePanel from './WorkerLodgePanel.vue'
import QuaTangTab from './worker-lodge/QuaTangTab.vue'
import ChieuMoTab from './worker-lodge/ChieuMoTab.vue'
import DuyenPhanTab from './worker-lodge/DuyenPhanTab.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { BETA_COMPANIONS } from '@/data/companion/Companions'
import { ITEM_GRADE_LABELS } from '@/core/item/ItemGrade'
import type { CompanionDefinition } from '@/data/companion/Companions'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// This suite exercises machinery the production feature table gates
// (hidden lineage / companion / workforce / sword-body ways) - it rides
// the full catalog like the pre-lock suite default did.
unlockAllFeaturesForTests()

// M-F-COMPANION-GIFT: the Beta pull pool is closed - inject
// companionAcquirablePool() so the live-pull success paths stay
// exercisable (architecture kept) and the closed-pool surfaces are the
// default (null override = real pool = [] under the Beta flag).
let acquirablePoolOverride: readonly CompanionDefinition[] | null = null
vi.mock('@/core/companion/CompanionAvailability', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/core/companion/CompanionAvailability')>()
  return {
    ...actual,
    companionAcquirablePool: () =>
      acquirablePoolOverride ?? actual.companionAcquirablePool(),
  }
})
function openPullPool(): void {
  acquirablePoolOverride = BETA_COMPANIONS
}

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
  vi.restoreAllMocks()
  acquirablePoolOverride = null
})

describe('CHQ integration smoke — DOM oracle thay browser probe', () => {
  it('WorkerLodgePanel remains an art-only landmark with no worker or upgrade controls', () => {
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

    expect(deps.container.querySelector('[data-testid="chi-hien-quan-art-only"]')).not.toBeNull()
    expect(deps.container.querySelector('.worker-lodge-panel__art')?.getAttribute('src')).toContain('chi_hien_quan/base.png')
    expect(deps.container.textContent ?? '').toContain('không có chức năng nâng cấp')
    expect(deps.container.textContent ?? '').not.toContain('Nhân công')
    expect(deps.container.querySelector('button')).toBeNull()

    deps.app.unmount()
  })

  it('ProductionPanel keeps Linh Mạch collection and autonomous site controls without workforce UI', async () => {
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

    const text = deps.container.textContent ?? ''

    expect(text).not.toContain('Nhân công')
    expect(text).not.toContain('Phân thủ công')
    expect(deps.container.querySelector('.worker-allocation__slider')).toBeNull()

    // Linh mach card render (outpost da xay - sau khi xoa spirit_spring).
    expect(text).toContain('Linh Mạch')

    expect(deps.container.querySelectorAll('[data-testid="production-upgrade"]')).toHaveLength(0)
    expect(deps.container.querySelector('.site-card .source-body button')).toBeNull()
    expect(deps.container.querySelector('.site-card__auto')).not.toBeNull()

    deps.app.unmount()
  })

  it('ProductionPanel no longer mounts worker assignment controls', async () => {
    const deps = makeDeps(ProductionPanel)
    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0,
    })
    const player = usePlayerStore(deps.pinia)
    player.realmId = 'mortal'
    deps.gameManager.setActivePlayer(player.$state)
    deps.app.mount(deps.container)
    await nextTick()

    expect(deps.container.querySelector('input[name="worker-mode"]')).toBeNull()
    expect(deps.container.querySelector('.worker-allocation__slider')).toBeNull()

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
  const selected = ref(1)
  const testHarness = defineComponent({
    setup: () => () => h('div', [
      h('nav', { class: 'companion-test-tabs' }, [0, 1, 2, 3].map(index => h('button', {
        type: 'button', onClick: () => { selected.value = index },
      }, String(index)))),
      selected.value === 0
        ? h('p', 'Chiêu Hiền Quán là công trình trưng bày.')
        : selected.value === 1
          ? h(QuaTangTab)
          : selected.value === 2
            ? h(ChieuMoTab)
            : h(DuyenPhanTab),
    ]),
  })
  const deps = makeDeps(testHarness)

  // Real material catalog so the Chieu Hien Lenh registry entry resolves
  // (token name label) and the v-tooltip directive used by DuyenPhanTab
  // registers like production (main.ts).
  deps.gameManager.catalogOps.registerMaterials(materials)
  deps.app.directive('tooltip', vTooltip)

  const player = usePlayerStore(deps.pinia)

  // P7-M9 (decision D4): the gacha tabs only exist once the Companion
  // domain unlocks at Tru Co, so the default mount runs a foundation
  // player; the realm-gate test mounts mortal explicitly.
  player.realmId = 'foundation_establishment'
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
  const tabs = container.querySelectorAll<HTMLButtonElement>('.companion-test-tabs button')

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
  it('companion surfaces remain testable independently after leaving Worker Lodge ownership', async () => {
    const deps = mountWorkerLodge()
    expect(deps.container.querySelector('.qua-tang__empty')).not.toBeNull()
    expect(deps.container.querySelector('.worker-lodge-panel')).toBeNull()
    deps.app.unmount()
  })

  // M-F-COMPANION-GIFT: with the pool closed the pull surface shows the
  // release-reason unavailable block (and the Qua Tang pointer); the
  // button stays disabled regardless of the token balance.
  it('chieu_mo tab: closed pool renders the unavailable block and disables pull', async () => {
    const deps = mountWorkerLodge()

    await openTab(deps.container, 2)

    const button = pullButton(deps.container)
    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(true)

    const unavailable = deps.container.querySelector('.chieu-mo__unavailable')
    expect(unavailable).not.toBeNull()
    expect(unavailable!.textContent ?? '').toContain('Chưa mở trong bản hiện tại')
    expect(unavailable!.textContent ?? '').toContain('Quà Tặng')

    deps.app.unmount()
  })

  it('chieu_mo tab: pull button disabled without a Chieu Hien Lenh token (open pool)', async () => {
    openPullPool()
    const deps = mountWorkerLodge()

    await openTab(deps.container, 2)

    const button = pullButton(deps.container)

    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(true)

    deps.app.unmount()
  })

  it('chieu_mo tab: pity counter renders player.companionPullsSinceRare', async () => {
    const deps = mountWorkerLodge()

    deps.player.companionPullsSinceRare = 12

    await openTab(deps.container, 2)

    expect(deps.container.textContent ?? '').toContain('12/30')

    deps.app.unmount()
  })

  it('chieu_mo tab: duplicate pull renders reveal card with constellationRankAfter', async () => {
    openPullPool()
    const deps = mountWorkerLodge()

    // Owning every acquirable definition (P7-M-G: the Beta pool) makes
    // any roll a duplicate - deterministic constellation_up at rank 1
    // without mocking random.
    deps.player.companions = BETA_COMPANIONS.map((definition) => ({
      instanceId: `inst_${definition.id}`,
      definitionId: definition.id,
      realmId: 'mortal',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    }))

    deps.gameManager.materialBag.add(PULL_TOKEN, 1)
    // Beta pool is {huyen, dia} - pin the roll to huyen (than_nong) so the
    // pity counter deterministically keeps counting (a dia roll resets).
    vi.spyOn(Math, 'random').mockReturnValue(0.1)

    await openTab(deps.container, 2)

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
    openPullPool()
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 0

    await openTab(deps.container, 3)

    const buttons = exchangeButtons(deps.container)

    // P7-M-G: exchange rows mirror the Beta-acquirable pool only.
    expect(buttons.length).toBe(BETA_COMPANIONS.length)
    expect(buttons.every((button) => button.disabled)).toBe(true)

    deps.app.unmount()
  })

  it('duyen_phan tab: constellation-maxed companion stays disabled even with enough points', async () => {
    openPullPool()
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 1000
    deps.player.companions = [
      {
        instanceId: 'inst_maxed',
        definitionId: BETA_COMPANIONS[0]!.id,
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 6,
      },
    ]

    await openTab(deps.container, 3)

    const rows = Array.from(deps.container.querySelectorAll<HTMLElement>('.duyen-phan__row'))

    expect(rows.length).toBe(BETA_COMPANIONS.length)

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
    openPullPool()
    const deps = mountWorkerLodge()

    // Beta pool row 0 = than_nong (huyen) - costs EXCHANGE_COST.huyen = 30.
    deps.player.duyenPhan = 30

    await openTab(deps.container, 3)

    const button = exchangeButtons(deps.container)[0]!

    expect(button.disabled).toBe(false)

    button.click()
    await nextTick()

    expect(deps.player.duyenPhan).toBe(0)
    expect(
      deps.player.companions.some((instance) => instance.definitionId === BETA_COMPANIONS[0]!.id),
    ).toBe(true)

    deps.app.unmount()
  })

  // M-F-COMPANION-GIFT: closed pool replaces the exchange rows with the
  // unavailable copy - the surface must say WHY, not render zero rows.
  it('duyen_phan tab: closed pool replaces rows with the unavailable block', async () => {
    const deps = mountWorkerLodge()

    deps.player.duyenPhan = 1000

    await openTab(deps.container, 3)

    expect(deps.container.querySelectorAll('.duyen-phan__row')).toHaveLength(0)
    const unavailable = deps.container.querySelector('.duyen-phan__unavailable')
    expect(unavailable).not.toBeNull()
    expect(unavailable!.textContent ?? '').toContain('Chưa mở trong bản hiện tại')
    expect(unavailable!.textContent ?? '').toContain('Quà Tặng')

    deps.app.unmount()
  })
})

// M-F-COMPANION-GIFT - the Qua Tang mail/gift surface: pending records
// claim through the ops transaction; the ops `kind:'loot'` push is the
// SINGLE success-notification owner (the UI only warns on failure).
describe('qua_tang gift tab (M-F-COMPANION-GIFT)', () => {
  it('renders the pending gift and an enabled claim button', async () => {
    const deps = mountWorkerLodge()
    deps.player.companionGifts.push({
      id: 'gift_than_nong_foundation_entry',
      definitionId: 'than_nong',
      claimed: false,
    })

    await openTab(deps.container, 1)

    const button = deps.container.querySelector<HTMLButtonElement>('.qua-tang__claim')
    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(false)
    expect(deps.container.textContent ?? '').toContain('Thần Nông')
    // Row contract: name + grade label + claim button (plan).
    expect(deps.container.querySelector('.qua-tang__grade')?.textContent).toBe(
      ITEM_GRADE_LABELS.huyen,
    )

    deps.app.unmount()
  })

  it('claim grants the companion once, marks claimed, and pushes exactly one loot toast', async () => {
    const deps = mountWorkerLodge()
    deps.player.companionGifts.push({
      id: 'gift_than_nong_foundation_entry',
      definitionId: 'than_nong',
      claimed: false,
    })

    await openTab(deps.container, 1)

    deps.container.querySelector<HTMLButtonElement>('.qua-tang__claim')!.click()
    await nextTick()

    expect(deps.player.companions.map((instance) => instance.definitionId)).toEqual([
      'than_nong',
    ])
    expect(deps.player.companionGifts[0]!.claimed).toBe(true)

    // Single-owner: exactly ONE success notification - the ops loot
    // event on the manager queue; the notification store gets nothing.
    const notifications = deps.gameManager.drainNotifications()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.kind).toBe('loot')
    expect(notifications[0]!.message).toContain('Thần Nông')
    expect(useNotificationStore(deps.pinia).toasts).toHaveLength(0)

    deps.app.unmount()
  })

  it('a claimed record renders in history and re-claim is a silent no-op', async () => {
    const deps = mountWorkerLodge()
    deps.player.companionGifts.push({
      id: 'gift_than_nong_foundation_entry',
      definitionId: 'than_nong',
      claimed: true,
    })

    await openTab(deps.container, 1)

    // Claimed record sits in the history list - no live claim button.
    expect(deps.container.querySelector('.qua-tang__claim')).toBeNull()
    expect(deps.container.querySelector('.qua-tang__claimed')).not.toBeNull()
    expect(deps.gameManager.drainNotifications()).toHaveLength(0)

    deps.app.unmount()
  })

  it('empty state renders when no gifts exist', async () => {
    const deps = mountWorkerLodge()

    await openTab(deps.container, 1)

    expect(deps.container.querySelector('.qua-tang__empty')).not.toBeNull()

    deps.app.unmount()
  })
})

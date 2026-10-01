// @vitest-environment jsdom
//
// QA FIXPOINT probe (Clean Round B - integration/consumer seam):
// hostile CONSUMER-side attacks on the beta scope contract
// (docs/design/frontend-contract.md). The admission gates are covered
// elsewhere; this file attacks the read/render/command surface a
// carried dormant record or a direct Pinia state write can reach:
//
//   * GameRoot defends ui.standalonePanel at the MOUNT seam ("a
//     scope-hidden panel can never mount even when a caller bypasses
//     ui.openStandalonePanel and assigns the state field directly").
//     The sibling seams - ui.activeBuildingPopoverId and
//     ui.leftPanelMode - must defend identically: a scope-hidden
//     building popover or left-panel mode can never render, because
//     downstream commands (buildBuilding/upgradeBuilding) are live
//     economy writes.
//   * Build/upgrade of the scope-hidden building (chi_hien_quan) is a
//     live-material spend plus a dormant-field write - the domain
//     command must fail closed the same way consumePill/assignWorkers
//     do.
//   * Contract sec.F: the worker lodge surface must render the
//     getWorkerLodgeSurfaceModel() verdicts and NEVER import
//     CompanionAvailability (explicit contract ban).
//   * Carried dormant records (armed auto-farm on an ineligible stage,
//     active progress on removed quests, hidden-realm records,
//     dormant-family materials) must deserialize inert.
//   * Precursor parity (contract sec.J): all three mortal precursors
//     share floor(casts/10) flat + Lv3 cast cap.
//   * Stage read-model (contract sec.E): every surface model's
//     displayEnemy resolves inside BETA_ENEMY_ROSTER.
//
// Assertions marked DEFECT fail on the audited state - each failure is
// the deterministic repro for a reported finding.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { i18n } from '@/i18n'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { vTooltip } from '@/directives/tooltip'
import FunctionOverlayPanel from '@/components/layout/FunctionOverlayPanel.vue'
import BuildingDetailPopover from '@/components/game/BuildingDetailPopover.vue'
import AutoFarmIndicator from '@/components/game/AutoFarmIndicator.vue'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { ENEMIES } from '@/data/enemy/Enemies'
import { QUESTS } from '@/data/quest/quests'
import { BETA_ENEMY_ROSTER } from '@/core/betaScope'
import { betaCompletionFor, betaHiddenRealmRecordFor } from '@/core/betaScopeSurface'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import {
  getPrecursorFlatDamageBonus,
  CAST_LEVELING_THRESHOLDS,
} from '@/core/skill/SkillSystem'
import { isMortalPrecursorSkillId } from '@/core/skill/MortalPrecursors'

// These suites assert the beta scope lock - pin the canonical
// all-false tables (the global test setup unlocks them).
lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function realGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerStages(STAGES)
  gameManager.catalogOps.registerZones(zones)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerQuests(QUESTS)
  return gameManager
}

// --- shared mount helper (project pattern: createApp + h, no test-utils) ---

function mountPanel(
  component: object,
  props: Record<string, unknown> | undefined,
  manager: GameManager,
  setup?: (player: ReturnType<typeof usePlayerStore>, pinia: ReturnType<typeof createPinia>) => void,
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never)

  const stateVersion = ref(0)
  const pinia = createPinia()
  const app = createApp({ render: () => h(component as never, props as never) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.directive('tooltip', vTooltip)

  const playerStore = usePlayerStore(pinia)
  setup?.(playerStore, pinia)

  app.mount(container)

  return { container, player: playerStore, pinia, unmount: () => { app.unmount(); container.remove() } }
}

// ---------------------------------------------------------------------------
// F-B-CONS-1: the left-panel mount seam trusts ui.leftPanelMode.
// A direct write mounts the scope-hidden worker_lodge surface -
// chi_hien_quan header (art, name, level, actionable upgrade) plus the
// nhan_cong capacity card reporting dormant capacity as live truth.
// ---------------------------------------------------------------------------
describe('consumer seam: worker_lodge left-panel mode (contract sec.G + sec.F)', () => {
  it('a direct ui.leftPanelMode write can never mount the scope-hidden panel', async () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'mortal' })
    gameManager.setActivePlayer(p)

    // Carried CHQ save: the lodge exists at level 3 with its dormant
    // capacity ledger intact.
    gameManager.buildingManager.add({
      instanceId: 'chq_1',
      buildingId: 'chi_hien_quan',
      level: 3,
      lastCollectedAt: 0,
    })
    p.autoWorkerCapacity = 7

    const view = mountPanel(FunctionOverlayPanel, undefined, gameManager, (_player, pinia) => {
      const ui = useUiStore(pinia)
      // The bypass class GameRoot defends at standalonePanel: assign the
      // store field directly, skipping the gated openLeftPanel action.
      ui.leftPanelMode = 'worker_lodge'
    })

    await nextTick()

    // DEFECT evidence: the scope-hidden worker lodge renders - tab bar,
    // capacity card, and the chi_hien_quan building header all appear.
    expect(view.container.querySelector('.worker-lodge-panel')).toBeNull()
    expect(view.container.querySelector('.building-heading')).toBeNull()
    expect(view.container.textContent).not.toContain('Chiêu Hiền Quán')

    view.unmount()
  })

  it('the mounted surface can spend live materials on the scope-hidden building (upgrade chain)', () => {
    const gameManager = realGameManager()
    // Foundation realm so the realm-tier gate inside upgrade() is NOT
    // the blocker - only the missing scope gate can refuse this.
    const p = player({ realmId: 'foundation_establishment' })
    gameManager.setActivePlayer(p)

    gameManager.buildingManager.add({
      instanceId: 'chq_1',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: 0,
    })
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_ore_decade'), 10)

    const oreBefore = gameManager.materialBag.getAmount('mortal_ore_decade')
    const upgraded = gameManager.buildingOps.upgradeBuilding('chq_1')

    // DEFECT evidence: the domain command is ungated - materials are
    // spent and the dormant autoWorkerCapacity field is written.
    expect(upgraded).toBe(false)
    expect(gameManager.materialBag.getAmount('mortal_ore_decade')).toBe(oreBefore)
  })
})

// ---------------------------------------------------------------------------
// F-B-CONS-2: the building popover mount seam trusts
// ui.activeBuildingPopoverId - a direct write renders the chi_hien_quan
// build card and its Build button runs the ungated domain command.
// ---------------------------------------------------------------------------
describe('consumer seam: chi_hien_quan building popover (contract sec.G)', () => {
  it('a direct ui.activeBuildingPopoverId write can never render the scope-hidden build card', async () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'mortal' })
    gameManager.setActivePlayer(p)

    const view = mountPanel(BuildingDetailPopover, { buildingId: 'chi_hien_quan' }, gameManager)

    await nextTick()

    // DEFECT evidence: the scope-hidden building renders its full build
    // surface (name + cost rows + actionable Build button).
    expect(view.container.querySelector('.building-popover')).toBeNull()
    expect(view.container.textContent).not.toContain('Chiêu Hiền Quán')

    view.unmount()
  })

  it('the popover Build path constructs the scope-hidden building and writes dormant capacity', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'mortal' })
    gameManager.setActivePlayer(p)

    const built = gameManager.buildingOps.buildBuilding('chi_hien_quan', p, Date.now() / 1000)

    // DEFECT evidence: ungated build - instance created, dormant field set.
    expect(built).toBeNull()
    expect(gameManager.buildingManager.getByBuildingId('chi_hien_quan')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// F-B-CONS-3: contract sec.F line-item - "Never import
// CompanionAvailability" on the worker lodge surface. The panel
// rederives tab verdicts from a realm predicate instead of consuming
// getWorkerLodgeSurfaceModel(), so the authored read model is dead code
// and the tab surface drifts from the verdict authority.
// ---------------------------------------------------------------------------
describe('consumer seam: worker lodge read-model consumption (contract sec.F)', () => {
  // F-B-CONS-3 — Low, deferred per Medium+-only ruling (human exception).
  // Skipped, not deleted: the pin stays dormant until the exception closes.
  it.skip('WorkerLodgePanel never imports CompanionAvailability and consumes the tab read model', () => {
    const source = readFileSync('src/components/panels/WorkerLodgePanel.vue', 'utf8')

    // DEFECT evidence: both assertions fail - the banned import is
    // present and the authored read model is never consulted.
    expect(source.includes('CompanionAvailability')).toBe(false)
    expect(source.includes('getWorkerLodgeSurfaceModel')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Clean probes - hostile inputs that resolve correctly (novel attack
// coverage; failures here would be NEW findings).
// ---------------------------------------------------------------------------

describe('stage read-model (contract sec.E) - roster containment', () => {
  it('every stage surface model displays only beta-roster enemies', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })
    gameManager.setActivePlayer(p)

    const roster = new Set(BETA_ENEMY_ROSTER.map((entry) => entry.id))
    const models = gameManager.stageOps.getStageSurfaceModels(p)

    expect(models.length).toBeGreaterThanOrEqual(30)

    for (const model of models) {
      if (model.displayEnemy !== undefined) {
        expect(
          roster.has(model.displayEnemy.id),
          `${model.stageId} displays non-roster enemy ${model.displayEnemy.id}`,
        ).toBe(true)
      }
    }
  })
})

describe('carried dormant auto-farm lease (save boundary)', () => {
  it('an armed farm on a never-perfect-cleared stage is dropped by restore-time reconcile', () => {
    const gameManager = realGameManager()
    const p = player({
      realmId: 'qi_refining',
      autoFarmStage: { stageId: 'mortal_dong_1', lastCheckedMs: 1 },
    })
    gameManager.setActivePlayer(p)

    gameManager.turnBattleOps.autoFarmOps.reconcileAutoFarmRuntime(p)

    expect(p.autoFarmStage).toBeNull()
  })

  it('an armed farm on an unregistered stage id is dropped, not settled', () => {
    const gameManager = realGameManager()
    const p = player({
      realmId: 'qi_refining',
      autoFarmStage: { stageId: 'ghost_stage_beta', lastCheckedMs: 1 },
      perfectClearStageIds: ['ghost_stage_beta'],
      perfectClearSeconds: { ghost_stage_beta: 60 },
    })
    gameManager.setActivePlayer(p)

    const stonesBefore = gameManager.materialBag.getAll().length
    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(p, 86400)
    gameManager.turnBattleOps.autoFarmOps.reconcileAutoFarmRuntime(p)

    expect(p.autoFarmStage).toBeNull()
    expect(gameManager.materialBag.getAll().length).toBe(stonesBefore)
  })
})

describe('auto-farm indicator honesty', () => {
  // F-B-CONS-4 — Low, deferred per Medium+-only ruling (human exception).
  it.skip('a farm whose stage id no longer resolves renders nothing actionable (no phantom name)', async () => {
    const gameManager = realGameManager()

    const view = mountPanel(AutoFarmIndicator, undefined, gameManager, (p) => {
      p.$state.autoFarmStage = { stageId: 'ghost_stage_beta', lastCheckedMs: 1 }
    })

    await nextTick()

    // The fallback prints the raw stage id - a carried corrupt lease
    // would read 'ghost_stage_beta' as a running farm. Assert the
    // indicator stays silent for unresolvable stages.
    expect(view.container.textContent).not.toContain('ghost_stage_beta')

    view.unmount()
  })
})

describe('precursor parity (contract sec.J)', () => {
  it('all three mortal precursors share floor(casts/10) flat damage, uncapped', () => {
    for (const skillId of ['tram', 'linh_bao', 'huy_quyen'] as const) {
      expect(isMortalPrecursorSkillId(skillId)).toBe(true)
      expect(CAST_LEVELING_THRESHOLDS[skillId], `${skillId} Lv3 cast cap`).toBeDefined()
    }
    // The ONE bonus function is the shared law - uncapped by design.
    expect(getPrecursorFlatDamageBonus(0)).toBe(0)
    expect(getPrecursorFlatDamageBonus(9)).toBe(0)
    expect(getPrecursorFlatDamageBonus(10)).toBe(1)
    expect(getPrecursorFlatDamageBonus(99_999)).toBe(9_999)
  })
})

describe('beta completion read model (contract sec.H)', () => {
  it('the ending beat resolves only when the act-3 boss stage is cleared', () => {
    const p = player()
    expect(betaCompletionFor(p).betaComplete).toBe(false)

    const completed = player({ completedStageIds: ['foundation_floor_10'] })
    expect(betaCompletionFor(completed).betaComplete).toBe(true)
  })
})

describe('carried dormant records stay flagged/inert', () => {
  it('hidden-realm records on a carried save never surface through the beta read model', () => {
    const p = player({
      realmId: 'qi_refining',
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: {
          qi_refining: { discovered: true, progress: 9, required: 10, completed: false } as never,
        },
      },
    })

    expect(betaHiddenRealmRecordFor(p, 'qi_refining')).toBeUndefined()
  })

  it('worker lodge tab verdicts: nhan_cong available, companion tabs scope-hidden', () => {
    const gameManager = realGameManager()
    const model = gameManager.buildingOps.getWorkerLodgeSurfaceModel()

    const byId = Object.fromEntries(model.tabs.map((tab) => [tab.id, tab]))
    expect(byId.nhan_cong?.verdict).toBe('available')
    expect(byId.nhan_cong?.manualAssignOffered).toBe(false)
    for (const tab of ['qua_tang', 'chieu_mo', 'duyen_phan'] as const) {
      expect(byId[tab]?.verdict).toBe('scope-hidden')
    }
  })

  it('dormant companion/artifact materials carry no vendor price (no live sink)', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })

    for (const id of ['chieu_hien_lenh', 'doan_bao_thach', 'duyen_phan']) {
      const result = gameManager.economyOps.sellMaterialToVendor(id, 1, p)
      expect(result.ok).toBe(false)
    }
  })

  it('quest lifecycle deactivates progress on removed/non-beta quests at restore', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })
    gameManager.setActivePlayer(p)

    // A carried save can hold ACTIVE progress on quest ids the beta
    // catalog removed (daily_*) - reconcile must converge the active set.
    gameManager.questManager.restore({
      active: [
        { questId: 'daily_chieu_hien_lenh', progress: 3, claimed: false },
        { questId: 'kill_foundation_floor_10_boss_1', progress: 0, claimed: false },
      ],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    })

    gameManager.tickOps.reconcileQuestLifecycle()

    const active = gameManager.questOps.getActiveQuests()
    const activeIds = active.map((entry) => entry.quest.id)
    expect(activeIds).not.toContain('daily_chieu_hien_lenh')
  })
})

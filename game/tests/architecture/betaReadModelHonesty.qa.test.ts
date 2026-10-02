// @vitest-environment jsdom
//
// QA FIXPOINT probe - read-model honesty (frontend-contract.md):
// - sec.D: post-commit the 4 non-committed element branches are
//   scope-hidden - the panel must not render them (no teaser, no 'locked').
// - sec.7/8: the combat role rail drops 'scope-hidden' roles - ultimate
//   has no beta role and must not render a slot.
// - sec.F: alchemy renders only beta-enabled recipe families - dormant
//   families must not appear (their craft path fails closed anyway, so a
//   rendered row is a dead button plus a content teaser).
// - sec.H: betaCompletionFor feeds the ending surface - at least one UI
//   module must consume it, else the ending beat never displays.
//
// Each assertion states CONTRACT behavior; failures on the pre-fix
// state are the deterministic repro evidence for the wave-3 findings.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { i18n } from '@/i18n'
import SkillPathPanel from '@/components/panels/SkillPathPanel.vue'
import AlchemyView from '@/components/panels/AlchemyView.vue'
import TurnCombatSkillBar from '@/components/game/combat/hud/TurnCombatSkillBar.vue'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { vTooltip } from '@/directives/tooltip'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import {
  betaSkillTreeFor as betaSkillTreeForDomain,
  betaCombatSurfacesFor as betaCombatSurfacesForDomain,
} from '@/core/betaScopeSkillDomain'
import { betaTechniqueSurfaceFor } from '@/core/betaScopeTechniqueDomain'
import type { PlayerData } from '@/core/player/Player'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import type { Material } from '@/core/material/Material'
import type { Pill } from '@/core/pill/Pill'
import type { Building } from '@/core/building/Building'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// These suites assert the beta scope lock - pin the canonical
// all-false feature table (the global test setup unlocks it).
lockBetaFeaturesForTests()

// --- combat bar fixture: a beta kit mints basic+special only; the
// presentation carries an EMPTY ultimate entry (the scope-hidden role). ---
const barMocks = vi.hoisted(() => ({
  slotList: [] as TurnSkillPresentationEntry[],
  chooseSlot: vi.fn(),
  setBattleManualMode: vi.fn(),
}))

vi.mock('@/composables/useTurnCombatManual', () => ({
  useTurnCombatManual: () => ({
    isAwaitingChoice: { value: false },
    isBattleFighting: { value: true },
    slotList: { value: barMocks.slotList },
    chooseSlot: barMocks.chooseSlot,
    dynamicBasicOptions: { value: [], __v_isRef: true },
    hasDynamicBasic: { value: false, __v_isRef: true },
    chooseDynamicBasic: vi.fn(),
  }),
}))

// --- shared mount helper (project pattern: createApp + h, no test-utils) ---

function mountPanel(
  component: object,
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
  const app = createApp({ render: () => h(component as never) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  setup?.(player, pinia)

  app.mount(container)

  return { container, player, pinia, unmount: () => { app.unmount(); container.remove() } }
}

function stubGameManager(): GameManager {
  return {
    skillManager: { getAll: () => [], get: () => undefined },
    getTurnBattle: () => null,
    techniqueManager: { getActive: () => undefined },
    nodeRegistry: { getAll: () => [], get: () => undefined },
    materialBag: { getAmount: () => 0 },
    materialRegistry: { get: () => undefined },
    realmAdvanceOps: {
      tryAdvanceTechniqueGrade: () => false,
      getBetaTechniqueSurfaceModel: (p: PlayerData) =>
        betaTechniqueSurfaceFor(p, {
          activeTechnique: undefined,
          materialAmount: () => 0,
          materialName: (id: string) => id,
          turnBattleInProgress: false,
        }),
    },
    hasPathCapability: () => false,
    setBattleManualMode: () => {},
    progressionOps: {
      getResolvedSkillRoles: () => ({ basic: { kind: 'dynamic', label: '-' } }),
      getSkillLevel: () => 1,
      getSkillCoreUpgradeCost: () => undefined,
      getSkillCoreMaxLevel: () => 1,
      levelUpSkill: () => false,
      setMortalBasicSkill: () => false,
      selectSkillSpecialization: () => false,
      purchaseNode: () => false,
      upgradeNode: () => false,
      selectSpellPathElement: () => false,
      devResetBranch: () => 0,
      allocateAttributePoint: () => false,
      // Beta rail (contract sec.7/8): basic+special render,
      // ultimate is scope-hidden in beta.
      betaCombatRolesFor: () => [
        { role: 'basic', state: 'available' },
        { role: 'special', state: 'progression-locked' },
        { role: 'ultimate', state: 'scope-hidden' },
      ],
      // Model reads delegate to the real domain verdicts - same
      // wiring as GameManagerProgressionOps.
      betaSkillTreeFor: (p: PlayerData, tree: readonly ProgressionNode[] = []) =>
        betaSkillTreeForDomain(p, tree),
      betaCombatSurfacesFor: (p: PlayerData) =>
        betaCombatSurfacesForDomain(p, { hasSkill: () => false }),
    },
  } as unknown as GameManager
}

describe('QA read-model honesty: skill path element branches (contract sec.D)', () => {
  it('post-commit renders only the committed element branch - foreign branches are scope-hidden', async () => {
    const view = mountPanel(SkillPathPanel, stubGameManager(), (player, pinia) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'spell'
      player.$state.cultivationWay = 'spell_pathway'
      player.$state.spellPath = { element: 'fire' }
      useUiStore(pinia).standalonePanel = 'skill'
    })

    await nextTick()

    const tabs = Array.from(
      view.container.querySelectorAll<HTMLElement>('.skill-path-panel__element-tab'),
    )

    // The committed element may render (marked); no other element may appear.
    for (const tab of tabs) {
      expect(tab.textContent?.trim()).toBe(ELEMENT_LABELS.fire)
    }
    expect(tabs.length).toBeLessThanOrEqual(1)

    view.unmount()
  })
})

describe('QA read-model honesty: combat role rail (contract sec.7/8)', () => {
  it('a scope-hidden ultimate role renders no slot button for a beta player', async () => {
    const READY: TurnSkillPresentationEntry = {
      skillId: 'tram', cooldownRemaining: 0, cooldownTotal: 0, resourceCost: 0, state: 'ready',
    }
    const EMPTY: TurnSkillPresentationEntry = {
      skillId: '', cooldownRemaining: 0, cooldownTotal: 0, resourceCost: 0, state: 'empty',
    }
    barMocks.slotList = [READY, READY, EMPTY]

    const gameManager = {
      ...stubGameManager(),
      hasPathCapability: () => false,
      setBattleManualMode: () => {},
    } as unknown as GameManager

    const view = mountPanel(TurnCombatSkillBar, gameManager, (player) => {
      player.$state.realmId = 'mortal'
      player.$state.cultivationPath = undefined
      player.$state.cultivationWay = undefined
    })
    useUiStore(view.pinia).combatInputMode = 'auto'

    await nextTick()

    const buttons = Array.from(
      view.container.querySelectorAll<HTMLButtonElement>(
        '.turn-combat-skill-bar__slot-button:not(.turn-combat-skill-bar__slot-button--orb)',
      ),
    )

    expect(buttons.length).toBe(2)

    view.unmount()
  })
})

const BETA_RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_mortal',
  pillId: 'tu_linh_dan_mortal',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'qa_herb', age: 'decade', label: 'Herb' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

const DORMANT_RECIPE: AlchemyRecipe = {
  // phi_van_dan is a real catalog family outside BETA_ENABLED_RECIPE_FAMILIES.
  id: 'alchemy_phi_van_dan_mortal',
  pillId: 'phi_van_dan_mortal',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'qa_herb', age: 'decade', label: 'Herb' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

const QA_MATERIALS: Material[] = [
  { id: 'qa_herb', name: 'QA Herb', category: 'herb', sourceType: 'exploration' },
  { id: 'mortal_wood_decade', name: 'QA Wood', category: 'wood', sourceType: 'exploration' },
]

const QA_PILLS: Pill[] = [
  { id: 'tu_linh_dan_mortal', name: 'Beta Pill', type: 'cultivation', grade: 'hoang', realmId: 'mortal', effects: [] },
  { id: 'phi_van_dan_mortal', name: 'Dormant Pill', type: 'cultivation', grade: 'hoang', realmId: 'mortal', effects: [] },
]

const PILL_ROOM: Building = {
  id: 'pill_room',
  name: 'Dan Phong',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 3,
  baseStorageCapacity: 0,
  upgradeCost: [[], [], []],
  functionType: 'pill_room',
}

describe('QA read-model honesty: alchemy recipe surface (contract sec.F)', () => {
  it('renders only beta-enabled recipe families - dormant families are scope-hidden', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerMaterials(QA_MATERIALS)
    gameManager.catalogOps.registerPills(QA_PILLS)
    gameManager.catalogOps.registerBuildings([PILL_ROOM])
    gameManager.catalogOps.registerAlchemyRecipes([BETA_RECIPE, DORMANT_RECIPE])

    const view = mountPanel(AlchemyView, gameManager, (player) => {
      player.$state.realmId = 'mortal'
    })

    await nextTick()

    const rows = Array.from(view.container.querySelectorAll<HTMLElement>('.alchemy-row'))
    expect(rows.length).toBe(1)
    expect(rows[0]?.textContent).not.toContain('Dormant Pill')

    view.unmount()
  })
})

describe('QA read-model honesty: beta completion surface (contract sec.H)', () => {
  it('betaCompletionFor has at least one UI consumer - the ending beat must render', () => {
    const consumers: string[] = []

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
          walk(path)
        } else if (entry.endsWith('.vue') || entry.endsWith('.ts')) {
          if (readFileSync(path, 'utf8').includes('betaCompletionFor')) {
            consumers.push(path)
          }
        }
      }
    }

    walk('src/components')
    if (readFileSync('src/App.vue', 'utf8').includes('betaCompletionFor')) {
      consumers.push('src/App.vue')
    }

    expect(consumers).not.toEqual([])
  })
})


describe('QA read-model honesty: production workforce surface (contract sec.4C)', () => {
  it('the manual worker-allocation block is scope-hidden while auto production stays visible (F-B3-03)', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerBuildings(buildings)
    gameManager.catalogOps.registerMaterials(materials)
    // Grant the panel gate building so <slot/> content actually renders.
    gameManager.buildingManager.add({
      instanceId: 'qa_outpost',
      buildingId: 'gathering_outpost',
      level: 1,
      lastCollectedAt: 0,
    })
    // A carried CHQ save's persisted assignment must not leak into the
    // hidden surface either.
    gameManager.productionSystem.restoreStates([
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [],
        assignedWorkers: 5,
      },
    ])

    const view = mountPanel(ProductionPanel, gameManager, (player) => {
      player.$state.realmId = 'mortal'
      player.$state.autoWorkerCapacity = 5
    })

    await nextTick()

    // Panel content is live (auto production keeps running) but the
    // manual allocation block is scope-hidden - no slider, no stale
    // '5 / 3 workers' header.
    expect(view.container.querySelector('.production-panel')).not.toBeNull()
    expect(view.container.querySelector('.worker-allocation')).toBeNull()

    view.unmount()
  })
})

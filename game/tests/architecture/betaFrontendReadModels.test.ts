/**
 * Guard (BETA FE-CONTRACT sec.4A/4B/4C + relayed skill-tree scope) -
 * the frontend renders canonical read-models; it never rederives the
 * predicates they already resolved.
 *
 * Contract: docs/design/frontend-contract.md sec.F. Three pin layers:
 *
 *   1. IMPORT DIRECTION (corpus over components/composables/stores):
 *      no shell file imports the domain predicates that decide
 *      technique grade eligibility, node purchase state, reward
 *      admission, or worker-lodge visibility. Type imports and pure
 *      DATA tables (labels, view tags, registry shape queries) stay
 *      legal - the ban targets decisions, not vocabulary.
 *
 *   2. VERDICT PINS: worker lodge scope-hidden on every navigation
 *      surface; the skill tree emits 'foreign-stamp' for way/path
 *      stamps foreign to the player.
 *
 *   3. READ-MODEL BEHAVIOR: betaTechniqueSurfaceFor /
 *      betaQuestSurfaceFor resolve every reason the contract lists.
 *
 * Setup note: tests/setup.betaScope.ts unlocks ways + features
 * globally, so the scope assertions re-pin the production locks first
 * (same convention as betaScopeSkillDomain.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import {
  betaSurfaceVerdict,
  isScopeHidden,
  WORKER_LODGE_TAB_FEATURE,
} from '@/core/betaScope'
import {
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
  isBetaWheelSlot,
} from '@/core/betaScopeSurface'
import {
  betaTechniqueSurfaceFor,
  type BetaTechniqueSurfaceDeps,
} from '@/core/betaScopeTechniqueDomain'
import {
  betaQuestSurfaceFor,
  type BetaQuestSurfaceDeps,
} from '@/core/betaScopeQuestDomain'
import { betaSkillTreeFor } from '@/core/betaScopeSkillDomain'
import type { Technique } from '@/core/technique/Technique'
import type { Quest } from '@/core/quest/Quest'
import type { QuestProgress } from '@/core/quest/QuestProgress'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import { PHAP_TU_NODES } from '@/data/progression/PhapTuNodes'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import { MaterialBag } from '@/core/material/MaterialBag'
import { PillRegistry } from '@/core/pill/PillRegistry'
import { PillBag } from '@/core/pill/PillBag'
import type { Material } from '@/core/material/Material'

lockBetaWaysForTests()
lockBetaFeaturesForTests()

// ---------------------------------------------------------------------------
// Corpus guards - the shell never rederives what the models resolve
// ---------------------------------------------------------------------------

const SRC_DIR = join(process.cwd(), 'src')

const SHELL_FILES = srcCorpus(SRC_DIR).filter(
  (file) =>
    !isTestFile(file.fromSrc) &&
    (file.fromSrc.startsWith('components/') ||
      file.fromSrc.startsWith('composables/') ||
      file.fromSrc.startsWith('stores/')),
)

/** Named imports a file pulls from one module path (empty when absent). */
function namedImports(fileText: string, modulePattern: string): string[] {
  const names: string[] = []
  const re = new RegExp(
    String.raw`\b(?:import|export)\s*\{([^}]*)\}\s*from\s*['"](?:${modulePattern})['"]`,
    'g',
  )
  let match: RegExpExecArray | null
  while ((match = re.exec(fileText)) !== null) {
    for (const raw of match[1]!.split(',')) {
      names.push(raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!)
    }
  }
  return names
}

describe('beta FE-contract read-models - import guards', () => {
  it(
    'has a shell corpus to police - a guard over nothing proves nothing',
    () => {
      expect(SHELL_FILES.length).toBeGreaterThan(50)
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file imports a technique grade/mastery predicate - the model owns eligibility',
    () => {
      // Everything betaTechniqueSurfaceFor composes; the frontend only
      // reads BetaTechniqueSurfaceModel + TECHNIQUE_TIER_LABELS
      // (display vocabulary) + projectTechniqueCompletion (slot picker
      // preview) - those stay legal.
      const BANNED = new Set([
        'canAdvanceTechniqueGrade',
        'getTechniqueGradeUpgradeCost',
        'getTechniqueGradeCeiling',
        'getTechniqueMasteryForNextRank',
        'getTechniqueTierForRank',
        'getTechniqueEffects',
        'TECHNIQUE_RANK_CAP',
      ])

      const offenders = SHELL_FILES.filter((file) =>
        namedImports(file.text, '@/core/technique/TechniqueProgression').some(
          (name) => BANNED.has(name),
        ),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file imports useTechniqueSections - sections ship inside the model',
    () => {
      const offenders = SHELL_FILES.filter((file) =>
        /\bfrom\s+['"]@\/composables\/useTechniqueSections['"]/.test(file.text),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file imports a NodeSystem state predicate - the skill-tree model owns node state',
    () => {
      // The BetaSkillTree read-model composes every one of these. What
      // stays legal: type imports (ProgressionNode), view-tag tables
      // (NodeBranchViews), and specializationClaimingNodes - a pure
      // REGISTRY shape query (which nodes claim a spec), never a
      // player-state decision.
      const BANNED = new Set([
        'canPurchaseNode',
        'canUpgradeNode',
        'getNodeLevel',
        'getNodeMaxLevel',
        'getEffectiveNodeMaxLevel',
        'getNextLevelCost',
        'getBlockingNodeLevelGates',
        'hasPrerequisite',
        'meetsPrerequisites',
        'nodePathApplies',
        'nodeWayApplies',
        'isNodeElementActive',
        'ownedNodeIds',
      ])

      const offenders = SHELL_FILES.filter((file) =>
        namedImports(file.text, '@/core/progression/NodeSystem').some((name) =>
          BANNED.has(name),
        ),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file imports getSkillCoreLevel - the ops accessor is the single read seam',
    () => {
      const offenders = SHELL_FILES.filter((file) =>
        namedImports(file.text, '@/core/progression/SkillCoreLevel').includes(
          'getSkillCoreLevel',
        ),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no panel imports ReleasePolicy or rebuilds reward admission',
    () => {
      // DongFuCommandWheel is a NAVIGATION surface (hotspot wheel): its
      // isRealmAvailable deep-link check is not reward admission, so it
      // is a recorded exception - everything under panels/ is not.
      const offenders = srcCorpus(SRC_DIR)
        .filter(
          (file) =>
            !isTestFile(file.fromSrc) &&
            file.fromSrc.startsWith('components/panels/') &&
            /ReleasePolicy|itemDrops|isCompanionPullTokenSourceSuppressed|domainUnlockRealmId|breakthroughRealmId/.test(
              file.text,
            ),
        )
        .map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the quest surface renders the canonical model - no ReleasePolicy, no admission rebuild',
    () => {
      const panel = SHELL_FILES.find(
        (file) => file.fromSrc === 'components/panels/QuestPanel.vue',
      )

      expect(panel, 'QuestPanel.vue missing from corpus').toBeDefined()
      expect(panel!.text).toContain('getBetaQuestSurfaceModels')
    },
    SCAN_TIMEOUT,
  )

  it(
    'worker lodge stays scope-hidden: no visibility predicate reaches its panel',
    () => {
      const panel = SHELL_FILES.find(
        (file) => file.fromSrc === 'components/panels/WorkerLodgePanel.vue',
      )

      expect(panel, 'WorkerLodgePanel.vue missing from corpus').toBeDefined()
      // The FINAL POLICY (sec.4C): the whole surface is scope-hidden -
      // the panel must read the model tabs and never import
      // CompanionAvailability domain gates itself.
      expect(panel!.text).toContain('getWorkerLodgeSurfaceModel')
      expect(
        /CompanionAvailability|isCompanionDomainUnlocked/.test(panel!.text),
      ).toBe(false)
    },
    SCAN_TIMEOUT,
  )

  it(
    'manual workforce ops have no ungated UI caller - allocation lives behind manualWorkforce only',
    () => {
      const offenders = SHELL_FILES.filter(
        (file) =>
          /assignWorkers|getWorkforceView/.test(file.text) &&
          file.fromSrc !== 'components/panels/ProductionPanel.vue',
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])

      const panel = SHELL_FILES.find(
        (file) => file.fromSrc === 'components/panels/ProductionPanel.vue',
      )

      // The allocation block renders ONLY behind the manualWorkforce
      // verdict - a panel that calls assignWorkers without the flag is
      // a leak, one that does neither is dead code.
      expect(panel, 'ProductionPanel.vue missing from corpus').toBeDefined()
      expect(panel!.text).toContain('manualWorkforce')
    },
    SCAN_TIMEOUT,
  )

  it(
    'the skill-path surfaces consume the canonical model',
    () => {
      const CONSUMERS: Record<string, string> = {
        'components/panels/SkillPathPanel.vue': 'betaSkillTreeFor',
        'components/panels/skill-path/NodeTreePanel.vue': 'betaSkillTreeFor',
        'components/panels/skill-path/NodeInspector.vue': 'BetaSkillTreeNode',
        'components/panels/skill-path/SkillRoleStrip.vue': 'betaSkillTreeFor',
        'components/panels/skill-path/TechniqueBand.vue':
          'getBetaTechniqueSurfaceModel',
        'components/panels/skill-path/TechniqueSlotCard.vue':
          'BetaTechniqueSurfaceModel',
      }

      for (const [fromSrc, token] of Object.entries(CONSUMERS)) {
        const file = SHELL_FILES.find((entry) => entry.fromSrc === fromSrc)

        expect(file, `${fromSrc} missing from corpus`).toBeDefined()
        expect(
          file!.text,
          `${fromSrc} must render the canonical read-model (${token})`,
        ).toContain(token)
      }
    },
    SCAN_TIMEOUT,
  )
})

// ---------------------------------------------------------------------------
// Verdict pins - the final PRODUCTION policy (sec.4C)
// ---------------------------------------------------------------------------

function qiPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    mortalBasicSkillId: undefined,
    spellPath: { element: null },
    ...overrides,
  }
}

describe('beta FE-contract - worker lodge final policy', () => {
  it('manualWorkforce is scope-hidden on every navigation surface', () => {
    expect(isScopeHidden('manualWorkforce')).toBe(true)
    expect(
      betaSurfaceVerdict('manualWorkforce', { progressionMet: true }),
    ).toBe('scope-hidden')
    // Every seam a player could reach the lodge through: wheel slot,
    // building hotspot, left-panel deep-link, and all four tab ids.
    expect(isBetaWheelSlot('chi_hien_quan')).toBe(false)
    expect(isBetaBuildingSurface('chi_hien_quan')).toBe(false)
    expect(isBetaLeftPanelMode('worker_lodge')).toBe(false)

    for (const feature of Object.values(WORKER_LODGE_TAB_FEATURE)) {
      expect(
        betaSurfaceVerdict(feature, { progressionMet: true }),
      ).toBe('scope-hidden')
    }
  })
})

// ---------------------------------------------------------------------------
// Read-model behavior - the verdicts the contract lists
// ---------------------------------------------------------------------------

function technique(grade: number): Technique {
  return {
    id: 'test_technique',
    name: 'Test Technique',
    description: '',
    grade,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
  }
}

function techniqueDeps(
  overrides: Partial<BetaTechniqueSurfaceDeps> = {},
): BetaTechniqueSurfaceDeps {
  return {
    activeTechnique: technique(1),
    materialAmount: () => 0,
    materialName: (id) => id,
    turnBattleInProgress: false,
    ...overrides,
  }
}

describe('betaTechniqueSurfaceFor', () => {
  it('no active technique -> unavailable state + no-technique reason', () => {
    const model = betaTechniqueSurfaceFor(
      qiPlayer(),
      techniqueDeps({ activeTechnique: undefined }),
    )

    expect(model.state).toBe('unavailable')
    expect(model.techniqueId).toBeUndefined()
    expect(model.sections).toEqual([])
    expect(model.gradeAdvance).toEqual({
      available: false,
      disabledReason: 'no-technique',
    })
  })

  it('grade below the realm-derived ceiling -> realm-gate with a quoted cost', () => {
    // qi_refining index 1: grade 1 is NOT < 1 -> realm-gate. The cost
    // still resolves - a disabled button renders the price line.
    const model = betaTechniqueSurfaceFor(qiPlayer(), techniqueDeps())

    expect(model.state).toBe('available')
    expect(model.gradeAdvance.available).toBe(false)
    expect(model.gradeAdvance.disabledReason).toBe('realm-gate')
    expect(model.gradeAdvance.targetGrade).toBe(2)
    expect(model.gradeAdvance.cost).toBe(200)
    expect(model.gradeAdvance.materialId).toBeDefined()
  })

  it('absolute grade ceiling -> grade-ceiling, no cost quote', () => {
    const model = betaTechniqueSurfaceFor(
      qiPlayer({ realmId: 'foundation_establishment' }),
      techniqueDeps({ activeTechnique: technique(99) }),
    )

    expect(model.gradeAdvance.available).toBe(false)
    expect(model.gradeAdvance.disabledReason).toBe('grade-ceiling')
    expect(model.gradeAdvance.cost).toBeUndefined()
  })

  it('turn battle -> busy', () => {
    const model = betaTechniqueSurfaceFor(
      qiPlayer({ realmId: 'foundation_establishment' }),
      techniqueDeps({ turnBattleInProgress: true }),
    )

    expect(model.gradeAdvance.disabledReason).toBe('busy')
  })

  it('empty bag -> insufficient-material with resolved owned/cost', () => {
    const model = betaTechniqueSurfaceFor(
      qiPlayer({ realmId: 'foundation_establishment' }),
      techniqueDeps({ materialAmount: () => 50 }),
    )

    expect(model.gradeAdvance.available).toBe(false)
    expect(model.gradeAdvance.disabledReason).toBe('insufficient-material')
    expect(model.gradeAdvance.owned).toBe(50)
    expect(model.gradeAdvance.cost).toBe(200)
  })

  it('funded bag at a gated realm -> available with the full preview', () => {
    const model = betaTechniqueSurfaceFor(
      qiPlayer({ realmId: 'foundation_establishment' }),
      techniqueDeps({ materialAmount: () => 999 }),
    )

    expect(model.gradeAdvance).toMatchObject({
      available: true,
      disabledReason: null,
      targetGrade: 2,
      cost: 200,
      owned: 999,
    })
    expect(model.name).toBe('Test Technique')
    expect(model.grade).toBe(1)
    expect(model.rankCapped).toBe(false)
    expect(model.tier).toBeDefined()
  })
})

function questDeps(
  overrides: Partial<BetaQuestSurfaceDeps> = {},
): BetaQuestSurfaceDeps {
  const materialRegistry = new MaterialRegistry()
  materialRegistry.register({
    id: 'linh_chi',
    name: 'Linh Chi',
    category: 'herb',
    sourceType: 'exploration',
  } as Material)

  return {
    materialRegistry,
    materialBag: new MaterialBag(),
    pillRegistry: new PillRegistry(),
    pillBag: new PillBag(),
    enemyName: (enemyId) => (enemyId === 'wild_wolf' ? 'Soi Hoang' : undefined),
    ...overrides,
  }
}

const collectQuest: Quest = {
  id: 'q_collect',
  name: 'Thu Thap',
  description: 'desc',
  condition: { kind: 'collect', materialId: 'linh_chi', amount: 5 },
  reward: {
    reward: { spiritStone: 10 },
    // An unregistered material - ReleasePolicy would never admit it;
    // the model must report spiritStone alone.
    itemDrops: [{ kind: 'material', itemId: 'ghost_mat', amount: 2 }],
  },
  cadence: 'once',
}

const killQuest: Quest = {
  id: 'q_kill',
  name: 'Tieu Diet',
  description: '',
  condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 3 },
  reward: { reward: { cultivation: 20 } },
  cadence: 'once',
}

function progress(overrides: Partial<QuestProgress> = {}): QuestProgress {
  return { questId: 'q', progress: 0, claimed: false, ...overrides }
}

describe('betaQuestSurfaceFor', () => {
  it('identity + once cadence + admitted rewards only', () => {
    const model = betaQuestSurfaceFor(
      collectQuest,
      progress({ progress: 2 }),
      qiPlayer(),
      questDeps(),
    )

    expect(model).toMatchObject({
      id: 'q_collect',
      cadence: 'once',
      progress: 2,
      target: 5,
      targetLabel: 'Linh Chi',
    })
    expect(model.rewards).toEqual([{ kind: 'spiritStone', amount: 10 }])
  })

  it('claim verdicts: incomplete -> missing-turnin-items -> available -> already-claimed', () => {
    const deps = questDeps()
    deps.materialBag.add(deps.materialRegistry.get('linh_chi'), 3)
    const player = qiPlayer()

    expect(
      betaQuestSurfaceFor(collectQuest, progress({ progress: 2 }), player, deps)
        .claim.disabledReason,
    ).toBe('incomplete')

    // Progress met but the bag is short - the turn-in preview reports
    // the live shortfall.
    const short = betaQuestSurfaceFor(
      collectQuest,
      progress({ progress: 5 }),
      player,
      deps,
    )
    expect(short.claim.disabledReason).toBe('missing-turnin-items')
    expect(short.turnIn).toEqual({
      materialId: 'linh_chi',
      required: 5,
      owned: 3,
    })

    deps.materialBag.add(deps.materialRegistry.get('linh_chi'), 2)
    expect(
      betaQuestSurfaceFor(collectQuest, progress({ progress: 5 }), player, deps)
        .claim,
    ).toEqual({ available: true, claimed: false, disabledReason: null })

    expect(
      betaQuestSurfaceFor(
        collectQuest,
        progress({ progress: 5, claimed: true }),
        player,
        deps,
      ).claim,
    ).toEqual({
      available: false,
      claimed: true,
      disabledReason: 'already-claimed',
    })
  })

  it('kill quests: enemy name label; unrestricted target renders null', () => {
    const named = betaQuestSurfaceFor(
      killQuest,
      progress({ progress: 1 }),
      qiPlayer(),
      questDeps(),
    )
    expect(named.targetLabel).toBe('Soi Hoang')
    expect(named.turnIn).toBeUndefined()
    expect(named.claim.disabledReason).toBe('incomplete')

    const anyEnemy = betaQuestSurfaceFor(
      {
        ...killQuest,
        condition: { kind: 'kill', amount: 3 },
      },
      progress(),
      qiPlayer(),
      questDeps(),
    )
    expect(anyEnemy.targetLabel).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Skill-tree model pins (relayed scope addition)
// ---------------------------------------------------------------------------

describe('betaSkillTreeFor - panel-facing fields', () => {
  it('tree-level fields resolve way name/tag + the casting gate', () => {
    const tree = betaSkillTreeFor(qiPlayer())

    expect(tree.way).toBe('spell_pathway')
    expect(tree.wayName).toBe(tree.way !== null ? tree.wayName : null)
    expect(typeof tree.wayName).toBe('string')
    expect(tree.wayNodeTreeTag).toBeUndefined()
    expect(tree.elementCasting).toBe(true)

    const mortal = betaSkillTreeFor({
      ...createDefaultPlayer(),
      realmId: 'mortal',
      mortalBasicSkillId: 'linh_bao',
    })
    expect(mortal.way).toBeNull()
    expect(mortal.wayName).toBeNull()
    expect(mortal.elementCasting).toBe(false)
  })

  it('a node stamped for a DIFFERENT beta-path is scope-hidden, never locked', () => {
    const foreignNode: ProgressionNode = {
      id: 'test_sword_stamped_node',
      name: 'Sword-Stamped Node',
      type: 'minor',
      elementTag: 'fire',
      insightCost: 1,
      maxLevel: 1,
      // A beta-realm path the player is not on - the requiredWay check
      // above it does not apply (none declared), so the route-stamp
      // gate is what hides it.
      requiredCultivationPath: 'sword',
      prerequisites: [],
      effect: {},
    }

    const tree = betaSkillTreeFor(
      qiPlayer({ spellPath: { element: 'fire' } }),
      [...PHAP_TU_NODES, foreignNode],
    )
    const node = tree.nodes.find((entry) => entry.nodeId === foreignNode.id)

    expect(node).toMatchObject({
      state: 'scope-hidden',
      reason: 'foreign-stamp',
    })
  })
})

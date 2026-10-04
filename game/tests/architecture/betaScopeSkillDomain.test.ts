/**
 * BETA SCOPE LOCK v2 Phase-3 - pins the canonical combat/skill-domain
 * read-models in src/core/betaScopeSkillDomain.ts (spec sec.7/8,
 * work-order sec.4/5/18-19):
 *
 *   - role rail is always [basic, special, ultimate]: Act I mortal =
 *     basic only; Act II qi_refining = basic (elemental post-commit);
 *     Act III foundation_establishment = basic + special; 'ultimate' is
 *     permanently 'scope-hidden' - never an empty slot;
 *   - the skill tree emits a per-node state for EVERY catalog node so
 *     the frontend renders, never decides: committed element's branch is
 *     purchased/purchasable/available/progression-locked, the other four
 *     elements' branches are 'scope-hidden' (not locked branches);
 *   - precursor surfaces (sword orb-picker dynamicBasic, An
 *     ngo_dao_hon_don ult-slot emblem) are scope-hidden in beta;
 *   - every admission fails closed: non-beta ways and corrupt saves
 *     scope-hide the whole surface instead of guessing.
 */
import { describe, expect, it } from 'vitest'
import {
  activeElementTreeFor,
  betaCombatRolesFor,
  betaCombatSurfacesFor,
  betaMortalTreeViewTags,
  betaSkillTreeFor,
  type BetaSkillTreeNode,
} from '@/core/betaScopeSkillDomain'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { PHAP_TU_NODES } from '@/data/progression/PhapTuNodes'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '@/data/progression/PhapTuNodes.builders'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { ElementType } from '@/core/element/ElementType'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// The global test setup unlocks every catalog way + feature for
// suites written pre-lock; this suite asserts canonical beta verdicts
// (non-beta ways are scope-hidden), so re-pin them.
lockBetaWaysForTests()
lockBetaFeaturesForTests()

const BETA_ELEMENTS: ElementType[] = ['fire', 'water', 'wood', 'metal', 'earth']

/** sec.7 kit table - the pinned Basic/Special pair per element. */
const SPEC_KITS: Record<ElementType, [string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh'],
  wood: ['doc_chuong', 'van_moc_sinh_co'],
  metal: ['diem_kim_thuat', 'kim_y_ngung_phong'],
  earth: ['tho_cau_thuat', 'trong_nhac'],
}

function deps(learned: readonly string[] = []) {
  const set = new Set(learned)

  return { hasSkill: (skillId: string) => set.has(skillId) }
}

function roleOf(
  rail: ReturnType<typeof betaCombatRolesFor>,
  role: 'basic' | 'special' | 'ultimate',
) {
  const entry = rail.find((candidate) => candidate.role === role)

  expect(entry, `expected role ${role} in the rail`).toBeDefined()

  return entry!
}

function mortalPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    realmId: 'mortal',
    cultivationPath: undefined,
    cultivationWay: undefined,
    mortalBasicSkillId: 'linh_bao',
    ...overrides,
  }
}

function spellPlayer(
  overrides: Partial<PlayerData> = {},
  element: ElementType | null = null,
): PlayerData {
  return {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    mortalBasicSkillId: undefined,
    spellPath: { element },
    // The element commit purchases the root atomically - mirror the
    // post-commit ownership the write path guarantees.
    nodeLevels: element === null ? {} : { [PHAP_TU_ELEMENT_ROOT_IDS[element]]: 1 },
    purchasedNodeIds:
      element === null ? [] : [PHAP_TU_ELEMENT_ROOT_IDS[element]],
    ...overrides,
  }
}

function swordPlayer(): PlayerData {
  return {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    cultivationPath: 'sword',
    cultivationWay: 'sword_pathway',
    mortalBasicSkillId: undefined,
  }
}

function nodeById(nodes: BetaSkillTreeNode[], nodeId: string): BetaSkillTreeNode {
  const node = nodes.find((entry) => entry.nodeId === nodeId)

  expect(node, `expected node ${nodeId} in the tree read-model`).toBeDefined()

  return node!
}

// ---------------------------------------------------------------------------
// Spec sec.7 - kit-table verification
// ---------------------------------------------------------------------------

describe('beta scope v2 phase-3 - sec.7 kit table', () => {
  it('SPELL_KIT_IDS is exactly the spec sec.7 Basic/Special mapping', () => {
    for (const element of BETA_ELEMENTS) {
      expect(SPELL_KIT_IDS[element]).toEqual(SPEC_KITS[element])
    }
  })

  it('element root unlocks the kit basic; linh_ngo_<special> unlocks the kit special', () => {
    for (const element of BETA_ELEMENTS) {
      const root = PHAP_TU_NODES.find(
        (node) => node.id === PHAP_TU_ELEMENT_ROOT_IDS[element],
      )
      const keystone = PHAP_TU_NODES.find(
        (node) => node.id === `linh_ngo_${SPEC_KITS[element][1]}`,
      )

      expect(root?.effect.unlocksSkillIds).toEqual([SPEC_KITS[element][0]])
      expect(keystone?.effect.unlocksSkillIds).toEqual([SPEC_KITS[element][1]])
    }
  })

  it('no tree node grants a hidden kit or any ultimate entry', () => {
    const hiddenKit = ['van_phap_tuy_tam', 'da_phap_lien_tuyen', 'ngo_dao_hon_don']

    for (const node of PHAP_TU_NODES) {
      const grants = [
        ...(node.effect.unlocksSkillIds ?? []),
        ...(node.effect.grantsSkillCoreIds ?? []),
      ]

      for (const grant of grants) {
        expect(hiddenKit).not.toContain(grant)
      }
    }

    // The kit tuple is exactly [basic, special] - no third/ultimate slot.
    for (const element of BETA_ELEMENTS) {
      expect(SPELL_KIT_IDS[element]).toHaveLength(2)
    }
  })
})

// ---------------------------------------------------------------------------
// A. Combat role rail
// ---------------------------------------------------------------------------

describe('beta scope v2 phase-3 - combat role rail', () => {
  it('always emits exactly [basic, special, ultimate] in order', () => {
    for (const player of [
      mortalPlayer(),
      spellPlayer(),
      spellPlayer({}, 'fire'),
      swordPlayer(),
      createDefaultPlayer(), // way-less non-mortal is covered below
    ]) {
      const rail = betaCombatRolesFor(player, deps(['linh_bao']))

      expect(rail.map((entry) => entry.role)).toEqual(['basic', 'special', 'ultimate'])
    }
  })

  it('Act I mortal: basic = the precursor pick, special progression-locked, ultimate scope-hidden', () => {
    const rail = betaCombatRolesFor(mortalPlayer(), deps(['linh_bao', 'tram', 'huy_quyen']))

    expect(roleOf(rail, 'basic')).toEqual({ role: 'basic', skillId: 'linh_bao', state: 'available' })
    expect(roleOf(rail, 'special')).toMatchObject({
      role: 'special',
      skillId: null,
      state: 'progression-locked',
      reason: 'realm-gate',
    })
    expect(roleOf(rail, 'ultimate')).toMatchObject({
      role: 'ultimate',
      skillId: null,
      state: 'scope-hidden',
    })
  })

  it('mortal basic mirrors the runtime pick guards (precursor + learned -> tram default)', () => {
    for (const [pick, learned, expected] of [
      ['tram', ['tram'], 'tram'],
      ['huy_quyen', ['huy_quyen'], 'huy_quyen'],
      // Illegal or unlearned picks resolve the tram default - the
      // read-model mirrors createMortalRuntime, never grants it.
      ['not_a_precursor', ['not_a_precursor'], 'tram'],
      ['linh_bao', [], 'tram'],
      [undefined, [], 'tram'],
    ] as const) {
      const rail = betaCombatRolesFor(
        mortalPlayer({ mortalBasicSkillId: pick }),
        deps(learned),
      )

      expect(roleOf(rail, 'basic').skillId).toBe(expected)
    }
  })

  it('Act II uncommitted: basic is the way starter linh_bao; special waits on element commit', () => {
    const rail = betaCombatRolesFor(spellPlayer(), deps(['linh_bao']))

    expect(roleOf(rail, 'basic')).toEqual({ role: 'basic', skillId: 'linh_bao', state: 'available' })
    expect(roleOf(rail, 'special')).toMatchObject({
      role: 'special',
      skillId: null,
      state: 'progression-locked',
      reason: 'element-uncommitted',
    })
    expect(roleOf(rail, 'ultimate').state).toBe('scope-hidden')
  })

  it('Act II committed: basic is the element kit basic; special is realm-gated but named', () => {
    const rail = betaCombatRolesFor(spellPlayer({}, 'fire'), deps(['hoa_cau_thuat']))

    expect(roleOf(rail, 'basic')).toEqual({
      role: 'basic',
      skillId: 'hoa_cau_thuat',
      state: 'available',
    })
    expect(roleOf(rail, 'special')).toMatchObject({
      role: 'special',
      skillId: 'tam_muoi_chan_hoa',
      state: 'progression-locked',
      reason: 'realm-gate',
    })
    expect(roleOf(rail, 'ultimate').state).toBe('scope-hidden')
  })

  it('Act III committed: special resolves learned state from the injected membership', () => {
    const foundationFire = spellPlayer({ realmId: 'foundation_establishment' }, 'fire')

    expect(
      roleOf(betaCombatRolesFor(foundationFire, deps(['hoa_cau_thuat'])), 'special'),
    ).toMatchObject({
      role: 'special',
      skillId: 'tam_muoi_chan_hoa',
      state: 'progression-locked',
      reason: 'not-learned',
    })

    expect(
      roleOf(
        betaCombatRolesFor(
          foundationFire,
          deps(['hoa_cau_thuat', 'tam_muoi_chan_hoa']),
        ),
        'special',
      ),
    ).toEqual({ role: 'special', skillId: 'tam_muoi_chan_hoa', state: 'available' })
  })

  it('non-beta ways scope-hide the whole rail; corrupt way-less non-mortal fails closed', () => {
    const swordRail = betaCombatRolesFor(swordPlayer(), deps())

    for (const entry of swordRail) {
      expect(entry.state).toBe('scope-hidden')
    }
    // basic/special carry the admission blocker; ultimate's constant
    // out-of-beta-scope reason is unchanged.
    expect(roleOf(swordRail, 'basic').reason).toBe('non-beta-way')
    expect(roleOf(swordRail, 'special').reason).toBe('non-beta-way')
    expect(roleOf(swordRail, 'ultimate').reason).toBe('out-of-beta-scope')

    const corrupt = { ...createDefaultPlayer(), realmId: 'qi_refining' }
    const corruptRail = betaCombatRolesFor(corrupt, deps())

    expect(roleOf(corruptRail, 'basic').reason).toBe('unresolved-way-state')
    expect(roleOf(corruptRail, 'special').reason).toBe('unresolved-way-state')
    expect(roleOf(corruptRail, 'ultimate').reason).toBe('out-of-beta-scope')
  })

  it('corrupt mortal + cultivationPath save fails closed (mortalBoundaryContractViolation pairing)', () => {
    // mortalBoundaryContractViolation rejects mortal+path on its face; the
    // read-model must not render an 'available' rail for that shape.
    const corruptMortal = mortalPlayer({
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
    })
    const rail = betaCombatRolesFor(corruptMortal, deps(['linh_bao']))

    for (const entry of rail) {
      expect(entry.state).toBe('scope-hidden')
      expect(entry.skillId).toBeNull()
    }
    expect(roleOf(rail, 'basic').reason).toBe('unresolved-way-state')
    expect(roleOf(rail, 'special').reason).toBe('unresolved-way-state')
  })
})

// ---------------------------------------------------------------------------
// B. Skill tree surface
// ---------------------------------------------------------------------------

describe('beta scope v2 phase-3 - skill tree read-model', () => {
  it('covers every catalog node with a per-node state', () => {
    const tree = betaSkillTreeFor(spellPlayer({}, 'fire'))

    expect(tree.nodes).toHaveLength(PHAP_TU_NODES.length)
    expect(new Set(tree.nodes.map((node) => node.nodeId)).size).toBe(
      PHAP_TU_NODES.length,
    )
  })

  it('mortal player: the whole tree is progression-locked (initiation-pending), never hidden', () => {
    const tree = betaSkillTreeFor(mortalPlayer())

    expect(tree.element).toBeNull()
    expect(tree.way).toBeNull()

    for (const node of tree.nodes) {
      if (node.reason === 'grant-only-node') {
        // Realm-reward grant nodes are never tree-rendered for anyone.
        expect(node.state).toBe('scope-hidden')
      } else {
        expect(node.state).toBe('progression-locked')
        expect(node.reason).toBe('initiation-pending')
      }
    }
  })

  it('mortal tree surface admits only the info-anchor branches (fire for linh_bao)', () => {
    const mortal = betaSkillTreeFor(mortalPlayer())

    expect(mortal.mortal).toBe(true)
    expect([...betaMortalTreeViewTags(PHAP_TU_NODES)]).toEqual(['fire'])

    const seat = nodeById(mortal.nodes, 'linh_bao_tien_than')
    expect(seat.state).toBe('progression-locked')
    expect(seat.reason).toBe('initiation-pending')
    expect(seat.infoSkillId).toBe('linh_bao')
    expect(seat.canUpgrade).toBe(false)
  })

  it('info anchor: renderable for every in-scope player but never purchasable', () => {
    // Uncommitted spell player browsing the element picker still reads it.
    const uncommitted = betaSkillTreeFor(spellPlayer())
    const seat = nodeById(uncommitted.nodes, 'linh_bao_tien_than')
    expect(seat.state).toBe('progression-locked')
    expect(seat.reason).toBe('info-only')

    // Committed fire: same info-only verdict, no Insight channel.
    const committed = betaSkillTreeFor(spellPlayer({ skillInsight: 50 }, 'fire'))
    const committedSeat = nodeById(committed.nodes, 'linh_bao_tien_than')
    expect(committedSeat.state).toBe('progression-locked')
    expect(committedSeat.reason).toBe('info-only')
    expect(committedSeat.canUpgrade).toBe(false)

    // Other-element commit: the seat hides with its branch.
    const water = betaSkillTreeFor(spellPlayer({}, 'water'))
    expect(nodeById(water.nodes, 'linh_bao_tien_than').state).toBe(
      'scope-hidden',
    )

    // Non-beta way: the whole surface fails closed, anchor included.
    const sword = betaSkillTreeFor(swordPlayer())
    expect(nodeById(sword.nodes, 'linh_bao_tien_than').state).toBe(
      'scope-hidden',
    )
  })

  it('corrupt mortal + cultivationPath save: every node is scope-hidden, nothing purchasable', () => {
    const corruptMortal = mortalPlayer({
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
    })
    const tree = betaSkillTreeFor(corruptMortal)

    for (const node of tree.nodes) {
      expect(node.state).toBe('scope-hidden')
      expect(node.canUpgrade).toBe(false)
    }
    expect(activeElementTreeFor(corruptMortal)).toHaveLength(0)
  })

  it('non-beta way: every node is scope-hidden (non-beta-way), including grant nodes', () => {
    const tree = betaSkillTreeFor(swordPlayer())

    for (const node of tree.nodes) {
      expect(node.state).toBe('scope-hidden')
    }
    expect(
      tree.nodes.every(
        (node) => node.reason === 'non-beta-way' || node.reason === 'grant-only-node',
      ),
    ).toBe(true)
  })

  it('uncommitted spell_pathway: the five roots are purchasable commit picks', () => {
    const tree = betaSkillTreeFor(spellPlayer())

    expect(tree.element).toBeNull()

    for (const element of BETA_ELEMENTS) {
      const root = nodeById(tree.nodes, PHAP_TU_ELEMENT_ROOT_IDS[element])

      expect(root.state).toBe('purchasable')
      expect(root.nextLevelCost).toBe(0)
      expect(root.grantsSkillIds).toEqual([SPEC_KITS[element][0]])
    }
  })

  it('post-commit: only the committed branch stays renderable; other four branches are scope-hidden', () => {
    const tree = betaSkillTreeFor(spellPlayer({}, 'fire'))

    expect(tree.element).toBe('fire')

    for (const node of tree.nodes) {
      if (node.elementTag === undefined) {
        // Way-less realm-reward grants: scope-hidden as grant-only.
        expect(node.state).toBe('scope-hidden')
        expect(node.reason).toBe('grant-only-node')
        continue
      }

      if (node.elementTag === 'fire') {
        // The element-tagged realm-reward grants (tinh_thong_*) are
        // never tree-rendered for anyone - grant-only trumps the branch
        // visibility check.
        if (node.reason === 'grant-only-node') {
          expect(node.state).toBe('scope-hidden')
        } else {
          expect(node.state).not.toBe('scope-hidden')
        }
      } else {
        expect(node.state).toBe('scope-hidden')
        // Branch nodes hide as other-element-branch; element-tagged
        // reward grants hide as grant-only (never tree-rendered).
        expect(['other-element-branch', 'grant-only-node']).toContain(node.reason)
      }
    }
  })

  it('activeElementTreeFor returns exactly the renderable surface', () => {
    const committed = activeElementTreeFor(spellPlayer({}, 'fire'))
    const full = betaSkillTreeFor(spellPlayer({}, 'fire'))

    expect(committed).toEqual(full.nodes.filter((node) => node.state !== 'scope-hidden'))
    expect(committed.every((node) => node.elementTag === 'fire')).toBe(true)
  })

  it('committed branch states: root purchased, growth purchasable, keystone realm-gated', () => {
    const player = spellPlayer({ skillInsight: 10 }, 'fire')
    const tree = betaSkillTreeFor(player)

    const root = nodeById(tree.nodes, 'hoa_linh_ngo')
    const mastery = nodeById(tree.nodes, 'fire_ailment_mastery')
    const keystone = nodeById(tree.nodes, 'linh_ngo_tam_muoi_chan_hoa')

    expect(root.state).toBe('purchased')
    expect(root.level).toBe(1)

    expect(mastery.state).toBe('purchasable')
    expect(mastery.affordable).toBe(true)
    expect(mastery.nextLevelCost).toBe(1)

    // Realm gate (foundation_establishment) unmet at qi_refining.
    expect(keystone.state).toBe('progression-locked')
    expect(keystone.reason).toBe('prerequisites-unmet')
    expect(
      keystone.prerequisites.find((gate) => gate.kind === 'realm'),
    ).toMatchObject({ gate: 'purchase', targetIds: ['foundation_establishment'], met: false })
    expect(
      keystone.prerequisites.find((gate) => gate.kind === 'node'),
    ).toMatchObject({ gate: 'purchase', targetIds: ['hoa_linh_ngo'], met: true })
    expect(keystone.nextLevelCost).toBe(2)
    expect(keystone.grantsSkillIds).toEqual(['tam_muoi_chan_hoa'])
  })

  it('insufficient insight keeps a gates-met node at available (never progression-locked)', () => {
    const player = spellPlayer({ skillInsight: 0 }, 'fire')
    const mastery = nodeById(
      betaSkillTreeFor(player).nodes,
      'fire_ailment_mastery',
    )

    expect(mastery.state).toBe('available')
    expect(mastery.reason).toBe('insufficient-insight')
    expect(mastery.affordable).toBe(false)
  })

  it('foundation realm makes the keystone purchasable; purchase reports state via nodeLevels', () => {
    const locked = nodeById(
      betaSkillTreeFor(spellPlayer({ realmId: 'foundation_establishment', skillInsight: 0 }, 'fire')).nodes,
      'linh_ngo_tam_muoi_chan_hoa',
    )

    // Gates met, insight short -> available, not realm-gated anymore.
    expect(locked.state).toBe('available')
    expect(locked.reason).toBe('insufficient-insight')

    const buyable = nodeById(
      betaSkillTreeFor(spellPlayer({ realmId: 'foundation_establishment', skillInsight: 2 }, 'fire')).nodes,
      'linh_ngo_tam_muoi_chan_hoa',
    )

    expect(buyable.state).toBe('purchasable')

    const owned = nodeById(
      betaSkillTreeFor(
        spellPlayer(
          {
            realmId: 'foundation_establishment',
            nodeLevels: {
              hoa_linh_ngo: 1,
              linh_ngo_tam_muoi_chan_hoa: 1,
            },
            purchasedNodeIds: ['hoa_linh_ngo', 'linh_ngo_tam_muoi_chan_hoa'],
          },
          'fire',
        ),
      ).nodes,
      'linh_ngo_tam_muoi_chan_hoa',
    )

    expect(owned.state).toBe('purchased')
    expect(owned.level).toBe(1)
  })

  it('levelGates expose the techniqueRank ceiling lift as display rows', () => {
    const player = spellPlayer({ realmId: 'foundation_establishment', skillInsight: 50 }, 'fire')
    const tree = betaSkillTreeFor(player)

    const gated = tree.nodes.find(
      (node) => node.elementTag === 'fire' && node.levelGates.length > 0,
    )

    expect(gated, 'expected a fire node with authored levelGates').toBeDefined()
    expect(gated!.effectiveMaxLevel).toBeLessThanOrEqual(gated!.maxLevel)
    const firstGate = gated!.levelGates[0]

    expect(firstGate).toBeDefined()
    expect(firstGate).toMatchObject({ gate: 'level' })
    expect(firstGate!.atLevel).toBeGreaterThanOrEqual(2)
  })

  it('foreign-catalog nodes stamped for a non-beta way are scope-hidden, never locked branches', () => {
    const foreignNode: ProgressionNode = {
      id: 'test_sword_node',
      name: 'Foreign Sword Node',
      type: 'minor',
      elementTag: 'fire',
      insightCost: 1,
      maxLevel: 1,
      requiredCultivationPath: 'sword',
      requiredWay: 'sword_pathway',
      prerequisites: [],
      effect: {},
    }
    // A fire-committed spell player evaluating a foreign catalog must
    // not see it as 'progression-locked' (a locked future feature).
    const tree = betaSkillTreeFor(spellPlayer({}, 'fire'), [
      ...PHAP_TU_NODES,
      foreignNode,
    ])
    const node = nodeById(tree.nodes, 'test_sword_node')

    expect(node.state).toBe('scope-hidden')
    expect(node.reason).toBe('non-beta-way')
    expect(
      activeElementTreeFor(spellPlayer({}, 'fire'), [
        ...PHAP_TU_NODES,
        foreignNode,
      ]).map((entry) => entry.nodeId),
    ).not.toContain('test_sword_node')
  })
})

// ---------------------------------------------------------------------------
// C. Precursor surfaces
// ---------------------------------------------------------------------------

describe('beta scope v2 phase-3 - precursor surfaces', () => {
  it('sword orb-picker and An ult emblem are scope-hidden for every beta player state', () => {
    for (const player of [
      mortalPlayer(),
      spellPlayer(),
      spellPlayer({}, 'fire'),
      spellPlayer({ realmId: 'foundation_establishment' }, 'earth'),
    ]) {
      const surfaces = betaCombatSurfacesFor(player, deps())

      expect(surfaces).toEqual([
        {
          surface: 'sword-dynamic-basic',
          state: 'scope-hidden',
          reason: 'out-of-beta-scope',
        },
        {
          surface: 'an-ultimate-emblem',
          state: 'scope-hidden',
          reason: 'out-of-beta-scope',
        },
      ])
    }
  })

  it('even a hidden-way player (emblem machinery live) keeps both surfaces scope-hidden', () => {
    const hiddenSpell = {
      ...createDefaultPlayer(),
      realmId: 'foundation_establishment',
      cultivationPath: 'spell' as const,
      cultivationWay: 'hidden_spell_pathway' as const,
      mortalBasicSkillId: undefined,
    }

    const surfaces = betaCombatSurfacesFor(hiddenSpell, deps(['ngo_dao_hon_don']))

    for (const surface of surfaces) {
      expect(surface.state).toBe('scope-hidden')
      expect(surface.reason).toBe('out-of-beta-scope')
    }
  })
})

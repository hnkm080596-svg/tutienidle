// @vitest-environment jsdom
// P7-M6 - techniqueRank/techniqueGrade prerequisites must resolve to
// their OWN lock reasons in NodeInspector (not the 'skillUpgrade'
// fallback). Mounts the real component through the project pattern
// (createApp + h + provide - no @vue/test-utils).
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import NodeInspector from './NodeInspector.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import {
  getEffectiveNodeMaxLevel,
  getNextLevelCost,
  getNodeLevel,
} from '@/core/progression/NodeSystem'
import type { PlayerData } from '@/core/player/Player'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { GameManager } from '@/core/game/GameManager'

function fixtureNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_node',
    name: 'Test Node',
    type: 'minor',
    insightCost: 1,
    effect: {},
    ...overrides,
  }
}

function mockGameManager(): Partial<GameManager> {
  return {
    nodeRegistry: {
      get: (id: string) => fixtureNode({ id, name: id }),
    } as GameManager['nodeRegistry'],
    skillManager: {
      get: () => undefined,
    } as unknown as GameManager['skillManager'],
    progressionOps: {
      getNextNodeCost: () => 1,
      purchaseNode: () => false,
      upgradeNode: () => false,
      selectSpellPathElement: () => false,
      setMortalBasicSkill: () => false,
      selectSkillSpecialization: () => false,
      switchRoute: () => 0,
      devResetBranch: () => 0,
      allocateAttributePoint: () => false,
    } as unknown as GameManager['progressionOps'],
  }
}

function mountInspector(
  node: ProgressionNode,
  techniqueProgress?: { rank: number; grade: number },
  realmId = 'mortal',
  opts: { purchasable?: boolean; inBattle?: boolean } = {},
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () =>
      h(NodeInspector, {
        node,
        purchased: false,
        purchasable: opts.purchasable ?? false,
        inBattle: opts.inBattle ?? false,
      }),
  })

  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, mockGameManager() as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  player.$state.techniqueProgress = techniqueProgress
  // M-F-TECHNIQUE (F5) - techniqueRank reads the effective rank: the
  // mirror's grade must equal the realm index to contribute its rank.
  player.$state.realmId = realmId
  // Afford the fixture node so cost never enters the reasons list.
  player.$state.skillInsight = 100

  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
    reasonTexts: () =>
      [...container.querySelectorAll('.node-inspector__reasons li')].map((li) => li.textContent),
  }
}

describe('NodeInspector - technique prerequisite lock reasons (P7-M6)', () => {
  it('an unmet techniqueRank gate shows the dedicated rank reason', async () => {
    const node = fixtureNode({ prerequisites: [{ kind: 'techniqueRank', rank: 5 }] })
    const view = mountInspector(node, { rank: 2, grade: 1 })

    await nextTick()

    const expected = i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', {
      rank: 5,
    })

    expect(view.reasonTexts()).toContain(expected)
    expect(view.reasonTexts()).not.toContain(
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.skillUpgrade'),
    )

    view.unmount()
  })

  it('an unmet techniqueGrade gate shows the dedicated grade reason', async () => {
    const node = fixtureNode({ prerequisites: [{ kind: 'techniqueGrade', grade: 3 }] })
    const view = mountInspector(node, { rank: 10, grade: 1 })

    await nextTick()

    const expected = i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.techniqueGrade', {
      grade: 3,
    })

    expect(view.reasonTexts()).toContain(expected)

    view.unmount()
  })

  it('a satisfied technique gate contributes no lock reason', async () => {
    const node = fixtureNode({
      prerequisites: [
        { kind: 'techniqueRank', rank: 5 },
        { kind: 'techniqueGrade', grade: 2 },
        { kind: 'realm', realmId: 'nascent_soul' },
      ],
    })
    const view = mountInspector(node, { rank: 10, grade: 2 }, 'foundation_establishment')

    await nextTick()

    // Only the realm gate remains unsatisfied.
    expect(view.reasonTexts()).toEqual([
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.realm'),
    ])

    view.unmount()
  })
})

// M-QI-06 - upgrade-gate reasons: a purchased node parked below its
// authored max by an unsatisfied levelGate shows the BINDING gate's
// reason (including frozen-surplus levels above the binding gate),
// never renders a null upgrade cost.
function mountOwnedInspector(
  node: ProgressionNode,
  techniqueProgress?: { rank: number; grade: number },
  realmId = 'mortal',
  opts: { inBattle?: boolean } = {},
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const gm: Partial<GameManager> = {
    nodeRegistry: {
      get: (id: string) => fixtureNode({ id, name: id }),
    } as GameManager['nodeRegistry'],
    skillManager: {
      get: () => undefined,
    } as unknown as GameManager['skillManager'],
    progressionOps: {
      getNextNodeCost: (nodeId: string, player: PlayerData) => {
        const target = node.id === nodeId ? node : fixtureNode({ id: nodeId, name: nodeId })
        const level = getNodeLevel(player, nodeId)

        return level >= getEffectiveNodeMaxLevel(player, target) || level < 1
          ? undefined
          : getNextLevelCost(target, level)
      },
      purchaseNode: () => false,
      upgradeNode: () => false,
      selectSpellPathElement: () => false,
      setMortalBasicSkill: () => false,
      selectSkillSpecialization: () => false,
      switchRoute: () => 0,
      devResetBranch: () => 0,
      allocateAttributePoint: () => false,
    } as unknown as GameManager['progressionOps'],
  }

  const app = createApp({
    render: () =>
      h(NodeInspector, {
        node,
        purchased: true,
        purchasable: false,
        inBattle: opts.inBattle ?? false,
      }),
  })

  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  player.$state.techniqueProgress = techniqueProgress
  player.$state.realmId = realmId
  player.$state.skillInsight = 500
  player.$state.nodeLevels[node.id] = 1
  player.$state.purchasedNodeIds.push(node.id)

  app.mount(container)

  return {
    container,
    player,
    app,
    unmount: () => {
      app.unmount()
      container.remove()
    },
    gateReasonTexts: () =>
      [...container.querySelectorAll('.node-inspector__gate-reasons li')].map((li) => li.textContent),
    gateHeader: () => container.querySelector('.node-inspector__gate-header')?.textContent ?? null,
    costText: () => container.querySelector('.node-inspector__cost')?.textContent?.trim() ?? null,
    upgradeButton: () =>
      container.querySelector<HTMLButtonElement>('.node-inspector__buy'),
  }
}

describe('NodeInspector - technique level-gate reasons (M-QI-06)', () => {
  const gated = () =>
    fixtureNode({
      id: 'test_gated_node',
      name: 'Gated Node',
      maxLevel: 10,
      upgradeCost: { base: 1, perLevel: 3 },
      levelGates: [
        { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
        { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
      ],
    })

  it('a node parked at its effective cap shows the binding rank reason and no upgrade cost', async () => {
    const node = gated()
    const view = mountOwnedInspector(node, { rank: 0, grade: 1 })
    view.player.$state.nodeLevels[node.id] = 5

    await nextTick()

    expect(view.gateHeader()).toBe(
      i18n.global.t('panels.skillPath.nodeInspector.upgradeGateHeader'),
    )
    expect(view.gateReasonTexts()).toEqual([
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', { rank: 3 }),
    ])
    expect(view.upgradeButton()?.disabled).toBe(true)
    expect(view.costText()).toBe('')

    view.unmount()
  })

  it('frozen surplus: an owned level above the binding gate still explains the blocker', async () => {
    const node = gated()
    const view = mountOwnedInspector(node, { rank: 0, grade: 2 })
    view.player.$state.nodeLevels[node.id] = 6

    await nextTick()

    expect(view.gateReasonTexts()).toEqual([
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', { rank: 3 }),
    ])
    expect(view.upgradeButton()?.disabled).toBe(true)

    view.unmount()
  })

  it('satisfying the gate re-enables the upgrade and clears the reasons', async () => {
    const node = gated()
    const view = mountOwnedInspector(node, { rank: 3, grade: 1 }, 'qi_refining')
    view.player.$state.nodeLevels[node.id] = 5

    await nextTick()

    expect(view.gateHeader()).toBeNull()
    expect(view.gateReasonTexts()).toEqual([])
    expect(view.upgradeButton()?.disabled).toBe(false)
    expect(view.costText()).toContain(
      i18n.global.t('panels.skillPath.nodeInspector.cost.upgrade', { cost: 2 }).trim(),
    )

    view.unmount()
  })

  it('a satisfied first gate still blocks at the later gate (no forecast, binding only)', async () => {
    const node = gated()
    const view = mountOwnedInspector(node, { rank: 3, grade: 1 }, 'qi_refining')
    view.player.$state.nodeLevels[node.id] = 8

    await nextTick()

    expect(view.gateReasonTexts()).toEqual([
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', { rank: 6 }),
    ])

    view.unmount()
  })
})

describe('NodeInspector - in-battle affordance disables (cleanD INT)', () => {
  it('inBattle disables the purchase button even when the node is purchasable', () => {
    const view = mountInspector(
      fixtureNode({ id: 'qa_battle_node', name: 'qa' }),
      undefined,
      'mortal',
      { purchasable: true, inBattle: true },
    )

    const buy = view.container.querySelector<HTMLButtonElement>('.node-inspector__buy')

    expect(buy).not.toBeNull()
    expect(buy!.disabled).toBe(true)
    view.unmount()
  })

  it('inBattle disables the upgrade button on an owned node', () => {
    const node = fixtureNode({ id: 'qa_owned', name: 'qa', maxLevel: 5 })
    const view = mountOwnedInspector(node, undefined, 'mortal', { inBattle: true })

    const upgrade = view.upgradeButton()

    expect(upgrade).not.toBeNull()
    expect(upgrade!.disabled).toBe(true)
    view.unmount()
  })
})

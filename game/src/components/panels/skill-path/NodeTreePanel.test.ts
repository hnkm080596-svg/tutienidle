// @vitest-environment jsdom
// M-QI-06 - tree entry under a technique level gate: a node parked at
// its effective cap shows the authored x/max badge, renders NO upgrade
// cost text, and never claims the is-maxed styling.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import NodeTreePanel from './NodeTreePanel.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { GameManager } from '@/core/game/GameManager'

function gatedNode(): ProgressionNode {
  return {
    id: 'test_tree_gated',
    name: 'Tree Gated',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 10,
    upgradeCost: { base: 1, perLevel: 3 },
    levelGates: [{ atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } }],
    elementTag: 'fire',
    effect: {},
  }
}

function mockGameManager(nodes: ProgressionNode[]): Partial<GameManager> {
  return {
    nodeRegistry: {
      getAll: () => nodes,
      get: (id: string) => nodes.find((node) => node.id === id)!,
      has: (id: string) => nodes.some((node) => node.id === id),
    } as unknown as GameManager['nodeRegistry'],
    getTurnBattle: () => null,
    progressionOps: {
    } as unknown as GameManager['progressionOps'],
  }
}

function mountTree(nodes: ProgressionNode[]) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)

  const app = createApp({
    render: () => h(NodeTreePanel, { branchTag: 'fire' }),
  })

  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, mockGameManager(nodes) as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  player.$state.skillInsight = 500

  app.mount(container)

  return {
    container,
    player,
    unmount: () => {
      app.unmount()
      container.remove()
    },
    nodeEl: () => container.querySelector('.node-tree__node'),
    levelBadge: () => container.querySelector('.node-tree__node-level')?.textContent?.trim() ?? null,
    costLabel: () => container.querySelector('.node-tree__node-cost')?.textContent?.trim() ?? null,
  }
}

describe('NodeTreePanel - technique level-gate entry (M-QI-06)', () => {
  it('a node at its effective cap shows authored x/max, no cost text, no is-maxed', async () => {
    const node = gatedNode()
    const view = mountTree([node])
    view.player.$state.techniqueProgress = { rank: 0, grade: 1 }
    view.player.$state.nodeLevels[node.id] = 5
    view.player.$state.purchasedNodeIds.push(node.id)

    await nextTick()

    expect(view.levelBadge()).toBe('5/10')
    expect(view.costLabel()).toBe('')
    expect(view.nodeEl()?.classList.contains('is-purchased')).toBe(true)
    expect(view.nodeEl()?.classList.contains('is-maxed')).toBe(false)

    view.unmount()
  })

  it('satisfying the gate restores the upgrade cost preview', async () => {
    const node = gatedNode()
    const view = mountTree([node])
    // M-F-TECHNIQUE (F5) - grade 1 at qi_refining is in-band: the
    // mirror's rank contributes to the effective rank again.
    view.player.$state.realmId = 'qi_refining'
    view.player.$state.techniqueProgress = { rank: 3, grade: 1 }
    view.player.$state.nodeLevels[node.id] = 5
    view.player.$state.purchasedNodeIds.push(node.id)

    await nextTick()

    expect(view.levelBadge()).toBe('5/10')
    expect(view.costLabel()).toContain(
      i18n.global.t('panels.nodeTree.labels.upgradeCost', { cost: 2 }),
    )

    view.unmount()
  })

  it('a truly maxed node keeps is-maxed styling', async () => {
    const node = gatedNode()
    const view = mountTree([node])
    view.player.$state.techniqueProgress = { rank: 10, grade: 1 }
    view.player.$state.nodeLevels[node.id] = 10
    view.player.$state.purchasedNodeIds.push(node.id)

    await nextTick()

    expect(view.levelBadge()).toBe('10/10')
    expect(view.costLabel()).toBe(i18n.global.t('panels.nodeTree.labels.maxLevel'))
    expect(view.nodeEl()?.classList.contains('is-maxed')).toBe(true)

    view.unmount()
  })
})

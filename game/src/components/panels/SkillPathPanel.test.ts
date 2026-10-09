// @vitest-environment jsdom
// Scene 07 (Ky Nang) fidelity integration: the panel mounts the paper
// constellation surface fed by the canonical betaSkillTreeFor model.
// These tests pin the DOMAIN contract through the new markup - way
// identity, node admission, purchase/upgrade routing, respec - not the
// retired 3-column layout.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import SkillPathPanel from './SkillPathPanel.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { GameManager } from '@/core/game/GameManager'
import { betaSkillTreeFor } from '@/core/betaScopeSkillDomain'
import { recordSessionLoginId } from '@/services/master/masterAccess'
import type { PlayerData } from '@/core/player/Player'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

function treeNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_node',
    name: 'Test Node',
    type: 'minor',
    insightCost: 5,
    maxLevel: 5,
    upgradeCost: { base: 2, perLevel: 2 },
    branchTag: 'kiem_pho',
    effect: {},
    ...overrides,
  }
}

function mockGameManager(overrides: {
  nodes?: ProgressionNode[]
  purchaseNode?: (nodeId: string) => boolean
  upgradeNode?: (nodeId: string) => boolean
  respecNodeTree?: () => number | false
  respecPreview?: object
} = {}): Partial<GameManager> {
  return {
    skillManager: {
      getAll: () => [],
      get: () => undefined,
    } as unknown as GameManager['skillManager'],
    getTurnBattle: () => null,
    techniqueManager: {
      getActive: () => undefined,
    } as unknown as GameManager['techniqueManager'],
    nodeRegistry: {
      getAll: () => overrides.nodes ?? [],
      get: () => undefined,
    } as unknown as GameManager['nodeRegistry'],
    progressionOps: {
      betaSkillTreeFor: (player: PlayerData, tree?: readonly ProgressionNode[]) =>
        betaSkillTreeFor(player, tree),
      purchaseNode: (nodeId: string) => overrides.purchaseNode?.(nodeId) ?? false,
      upgradeNode: (nodeId: string) => overrides.upgradeNode?.(nodeId) ?? false,
      respecNodeTree: () => overrides.respecNodeTree?.() ?? 0,
      previewNodeRespec: () => overrides.respecPreview ?? { refund: 5, resetCount: 1 },
      allocateAttributePoint: () => false,
    } as unknown as GameManager['progressionOps'],
  }
}

function mountPanel(
  setup: (player: ReturnType<typeof usePlayerStore>) => void,
  manager: Partial<GameManager> = mockGameManager(),
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(SkillPathPanel) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  player.$state.realmId = 'qi_refining'
  setup(player)
  useUiStore(pinia).standalonePanel = 'skill'

  app.mount(container)

  return {
    container,
    scene: () => container.querySelector('.skill-paper-scene'),
    nodes: () => container.querySelectorAll('.skill-node'),
    heading: () => container.querySelector('.skill-head p')?.textContent ?? null,
    holdHint: () => container.querySelector<HTMLElement>('.skill-hold-hint'),
    holdCircle: (id: string) =>
      container.querySelector<SVGCircleElement>(`.skill-node[data-node-id="${id}"] .skill-node-hold circle`),
    respecButton: () => container.querySelector<HTMLButtonElement>('.skill-respec'),
    selectNode: (id: string) =>
      container.querySelector<HTMLButtonElement>(`.skill-node[data-node-id="${id}"]`),
    unmount: () => { app.unmount(); container.remove() },
  }
}

describe('SkillPathPanel (scene 07 fidelity)', () => {
  it('a way-less mortal sees the Phan Nhan identity, an empty graph and no respec entry', async () => {
    // Minh ruling (2026-10-07): respec is a master-only dev tool - the
    // button is v-if=isMaster, so a non-master mortal sees no entry at
    // all (there is no disabled state to pin).
    const view = mountPanel(() => {})

    await nextTick()

    expect(view.scene()).not.toBeNull()
    expect(view.heading()).toBe(i18n.global.t('panels.skillPath.mortalName'))
    expect(view.nodes().length).toBe(0)
    expect(view.respecButton()).toBeNull()
    expect(view.container.textContent).toContain(i18n.global.t('panels.skillPath.nodeInspector.empty'))

    view.unmount()
  })

  it('a committed sword way renders identity + its pathway nodes only', async () => {
    const nodes = [
      treeNode({ id: 'kiem_root', name: 'Kiếm Gốc', prerequisites: [] }),
      treeNode({ id: 'kiem_child', name: 'Kiếm Chi', prerequisites: [{ kind: 'node', nodeId: 'kiem_root' }] }),
      treeNode({ id: 'foreign_node', name: 'Foreign', branchTag: 'other_branch' }),
    ]
    const view = mountPanel((player) => {
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
      player.$state.skillInsight = 100
    }, mockGameManager({ nodes }))

    await nextTick()

    expect(view.heading()).toBe('Kiếm Tu — Ngự Kiếm Tâm Kinh')
    expect(view.nodes().length).toBe(2)

    view.unmount()
  })

  it('a purchasable node unlocks through purchaseNode; an owned node upgrades through upgradeNode', async () => {
    const purchaseNode = vi.fn(() => true)
    const upgradeNode = vi.fn(() => true)
    const nodes = [
      treeNode({ id: 'kiem_root', name: 'Kiếm Gốc' }),
      treeNode({ id: 'kiem_owned', name: 'Kiếm Đã Có' }),
    ]
    const view = mountPanel((player) => {
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
      player.$state.skillInsight = 100
      player.$state.nodeLevels['kiem_owned'] = 1
      player.$state.purchasedNodeIds.push('kiem_owned')
    }, mockGameManager({ nodes, purchaseNode, upgradeNode }))

    await nextTick()

    // Root (unpurchased, prereq-free, affordable) -> unlock hold hint;
    // activation is press-and-hold on the node (no button in the card).
    view.selectNode('kiem_root')!.click()
    await nextTick()
    expect(view.holdHint()!.textContent).toContain(i18n.global.t('panels.skillPath.nodeInspector.actions.unlock'))
    view.selectNode('kiem_root')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    await nextTick()
    view.holdCircle('kiem_root')!.dispatchEvent(new Event('animationend'))
    await nextTick()
    expect(purchaseNode).toHaveBeenCalledWith('kiem_root')

    // Owned node -> upgrade hold hint.
    view.selectNode('kiem_owned')!.click()
    await nextTick()
    expect(view.holdHint()!.textContent).toContain(i18n.global.t('panels.skillPath.nodeInspector.actions.upgrade'))
    view.selectNode('kiem_owned')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    await nextTick()
    view.holdCircle('kiem_owned')!.dispatchEvent(new Event('animationend'))
    await nextTick()
    expect(upgradeNode).toHaveBeenCalledWith('kiem_owned')

    view.unmount()
  })

  it('respec opens the canonical confirm and commits respecNodeTree', async () => {
    // The respec button exists for master accounts only - mount with an
    // allowlisted loginId, then release the session id afterwards so it
    // cannot leak into sibling tests.
    recordSessionLoginId('admin')
    const respecNodeTree = vi.fn(() => 5)
    const view = mountPanel((player) => {
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
      player.$state.skillInsight = 100
      player.$state.nodeLevels['kiem_root'] = 1
      player.$state.purchasedNodeIds.push('kiem_root')
    }, mockGameManager({ nodes: [treeNode({ id: 'kiem_root', name: 'Kiếm Gốc' })], respecNodeTree }))

    await nextTick()

    const respec = view.respecButton()!
    expect(respec.disabled).toBe(false)
    respec.click()
    await nextTick()

    // ConfirmModal teleports to body.
    expect(document.body.textContent).toContain(i18n.global.t('panels.nodeTree.respec.title'))
    const confirm = document.body.querySelector<HTMLButtonElement>('.confirm-modal__confirm')
    expect(confirm).not.toBeNull()
    confirm!.click()
    await nextTick()

    expect(respecNodeTree).toHaveBeenCalledTimes(1)

    view.unmount()
    recordSessionLoginId(undefined)
  })
})

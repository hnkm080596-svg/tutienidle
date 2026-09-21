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

function mountInspector(node: ProgressionNode, techniqueProgress?: { rank: number; grade: number }) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () => h(NodeInspector, { node, purchased: false, purchasable: false }),
  })

  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, mockGameManager() as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  player.$state.techniqueProgress = techniqueProgress
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
    const view = mountInspector(node, { rank: 10, grade: 2 })

    await nextTick()

    // Only the realm gate remains unsatisfied.
    expect(view.reasonTexts()).toEqual([
      i18n.global.t('panels.skillPath.nodeInspector.lockedReasons.realm'),
    ])

    view.unmount()
  })
})

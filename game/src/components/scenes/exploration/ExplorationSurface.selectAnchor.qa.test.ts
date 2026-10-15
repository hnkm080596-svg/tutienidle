// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

// QA-C blind adversarial review - FAILING REPRO, no production edits.
//
// DEFECT D1 (selection anchor): ExplorationSurface.selectFirstStageInZone
// picks `stagesInZone.find(model.state !== 'locked')` - the EARLIEST
// unlocked stage in roster order. For a player mid-progress that is a
// CLEARED stage (ai 1), not the frontier ai. The function's own comment
// claims the pick "lands in the earliest incomplete chapter"; under the
// merged single 'thanh_van' card it lands on ai 1 forever, so every
// scene open shows a dead stage's detail pane instead of the actionable
// frontier ('current') node. Same stale pick inside selectChapter().
//
// Expected: selection anchors on the first unlocked-UNCOMPLETED stage
// (the 'current' frontier). Actual: ai 1 (state 'completed').

const capturedStageIds: (string | null | undefined)[] = []
let emitBuildFromScene: (() => void) | undefined

vi.mock('./fidelity/ExplorationFidelityScene.vue', () => ({
  default: defineComponent({
    props: ['model', 'stage', 'chapter', 'notice', 'preview'],
    emits: ['open-build'],
    setup(props, { emit }) {
      emitBuildFromScene = () => emit('open-build')
      return () => {
        capturedStageIds.push((props.stage as { id?: string } | null)?.id ?? null)
        return h('div')
      }
    },
  }),
}))

vi.mock('@/components/common/SceneDesignCanvas.vue', () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
}))

import ExplorationSurface from './ExplorationSurface.vue'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'

const STAGES = [
  { id: 'ai1', name: 'Ai 1', chapter: 1, floor: 1, description: '', totalEnemyCount: 3 },
  { id: 'ai2', name: 'Ai 2', chapter: 1, floor: 2, description: '', totalEnemyCount: 3 },
  { id: 'ai3', name: 'Ai 3', chapter: 1, floor: 3, description: '', totalEnemyCount: 3 },
]

const MODELS = [
  { stageId: 'ai1', state: 'completed', floor: 1, startAvailable: true },
  { stageId: 'ai2', state: 'completed', floor: 2, startAvailable: true },
  // The frontier node - 'current' per surfaceState semantics.
  { stageId: 'ai3', state: 'current', floor: 3, startAvailable: true },
]

function mountSurface() {
  capturedStageIds.length = 0
  const pinia = createPinia()
  setActivePinia(pinia)

  const gameManager = {
    zoneRegistry: {
      getAll: () => [{ id: 'thanh_van', name: 'Thanh Van', stageIds: ['ai1', 'ai2', 'ai3'], requiredRealmId: undefined }],
    },
    catalogOps: {
      getStage: (id: string) => STAGES.find((stage) => stage.id === id),
    },
    stageOps: {
      getStageSurfaceModels: () => MODELS,
    },
    materialRegistry: { has: () => false, get: () => undefined },
    equipmentRegistry: { has: () => false, get: () => undefined },
    pillRegistry: { has: () => false, get: () => undefined },
    turnBattleOps: {
      autoFarmOps: { startAutoFarm: () => false, stopAutoFarm: () => {} },
    },
  }

  const container = document.createElement('div')
  const app = createApp({ render: () => h(ExplorationSurface) })
  app.use(pinia)
  app.use(
    createI18n({ legacy: false, locale: 'vi', messages: { vi: {} } }),
  )
  app.provide(GAME_MANAGER_KEY, gameManager as never)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.mount(container)
  return app
}

describe('QA-C D1 - exploration selection anchors on the frontier stage', () => {
  it('opening the surface selects the first unlocked-UNCOMPLETED stage, not ai 1 (cleared)', async () => {
    const app = mountSurface()
    try {
      await Promise.resolve()
      // The documented pick is "the earliest incomplete" - under model
      // states completed/completed/current that is ai3 (the frontier).
      expect(capturedStageIds.at(-1)).toBe('ai3')
    } finally {
      app.unmount()
    }
  })

  it('routes @build through ui.openStandalonePanel("skill") so only one panel stays open (Slice 1.3 / D7)', async () => {
    const app = mountSurface()
    try {
      const ui = useUiStore()
      ui.openLeftPanel('stage_select')
      expect(ui.leftPanelMode).toBe('stage_select')

      emitBuildFromScene?.()
      expect(ui.standalonePanel).toBe('skill')
      expect(ui.leftPanelMode).toBeNull()
    } finally {
      app.unmount()
    }
  })
})

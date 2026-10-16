// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

let resolveFx: (() => void) | undefined
let rejectFx: ((err: Error) => void) | undefined

vi.mock('@/components/fx/breakthroughFx', () => ({
  playBreakthroughFx: vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        resolveFx = resolve
        rejectFx = reject
      }),
  ),
}))

let latestModel: { currentFloor: number; canAdvanceFloor: boolean } | undefined
let latestSelected: number | undefined
let emitAdvanceFloor: (() => void) | undefined

vi.mock('./fidelity/RealmFidelityScene.vue', () => ({
  default: defineComponent({
    props: ['model', 'selected', 'preview'],
    emits: ['advance'],
    setup(props, { emit }) {
      emitAdvanceFloor = () => emit('advance')
      return () => {
        latestModel = props.model as { currentFloor: number; canAdvanceFloor: boolean }
        latestSelected = props.selected as number
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

import RealmSurface from './RealmSurface.vue'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import type { BreakthroughOutcomeResult } from '@/core/tribulation/BreakthroughOutcomeService'
import { playBreakthroughFx } from '@/components/fx/breakthroughFx'

function mountRealmSurface(shouldFail = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const player = usePlayerStore()
  player.realmId = 'mortal'
  player.realmLevel = 1
  player.cultivation = player.cultivationRequired

  const gameManager = {
    realmAdvanceOps: {
      canTriggerBreakthrough: () => false,
      getBreakthroughRequirements: () => [],
      breakthroughWithConsequences: vi.fn((target: typeof player): BreakthroughOutcomeResult => {
        if (shouldFail) {
          return { kind: 'failure' }
        }
        target.realmLevel += 1
        target.cultivation = 0
        return {
          kind: 'success',
          newLevel: target.realmLevel,
          majorRealmChanged: false,
          artifactTouched: false,
          announcement: null,
        }
      }),
    },
  }

  const container = document.createElement('div')
  const app = createApp({ render: () => h(RealmSurface) })
  app.use(pinia)
  app.use(createI18n({ legacy: false, locale: 'vi', messages: { vi: {} } }))
  app.provide(GAME_MANAGER_KEY, gameManager as never)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.mount(container)
  return { app, player, gameManager }
}

describe('RealmSurface — onAdvanceFloor commit-before-FX (Slice 1.4 / D2)', () => {
  it('commits breakthroughWithConsequences immediately while holding displayedFloor until FX resolves', async () => {
    const { app, player, gameManager } = mountRealmSurface()
    try {
      expect(player.realmLevel).toBe(1)
      expect(latestModel?.currentFloor).toBe(1)

      emitAdvanceFloor?.()
      await Promise.resolve()

      // Authoritative state committed immediately BEFORE FX resolves.
      expect(gameManager.realmAdvanceOps.breakthroughWithConsequences).toHaveBeenCalledTimes(1)
      expect(player.realmLevel).toBe(2)
      // Display holds floor 1 during the inhale FX.
      expect(latestModel?.currentFloor).toBe(1)
      expect(latestSelected).toBe(1)

      resolveFx?.()
      await Promise.resolve()
      await Promise.resolve()

      expect(latestModel?.currentFloor).toBe(2)
      expect(latestSelected).toBe(2)
    } finally {
      app.unmount()
    }
  })

  it('preserves committed floor advance and resets display when FX rejects', async () => {
    const { app, player } = mountRealmSurface()
    try {
      emitAdvanceFloor?.()
      await Promise.resolve()
      expect(player.realmLevel).toBe(2)

      rejectFx?.(new Error('FX failure'))
      await Promise.resolve()
      await Promise.resolve()

      expect(player.realmLevel).toBe(2)
      expect(latestModel?.currentFloor).toBe(2)
      expect(latestSelected).toBe(2)
    } finally {
      app.unmount()
    }
  })

  it('does not play FX and restores displayedFloor when breakthroughWithConsequences returns failure', async () => {
    vi.mocked(playBreakthroughFx).mockClear()
    const { app, player } = mountRealmSurface(true)
    try {
      emitAdvanceFloor?.()
      await Promise.resolve()

      expect(player.realmLevel).toBe(1)
      expect(latestModel?.currentFloor).toBe(1)
      expect(playBreakthroughFx).not.toHaveBeenCalled()
    } finally {
      app.unmount()
    }
  })
})

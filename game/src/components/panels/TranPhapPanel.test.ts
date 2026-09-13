// @vitest-environment jsdom
// TranPhapPanel (architecture-qa-repairs F4, 2026-09-13) - mounted-component
// tests over a real GameManager, same harness as CompanionPanel.test.ts.
// Verifies the formation loadout commit goes through the validating owner
// (gameManager.turnBattleOps.setFormationLoadout) instead of the panel
// writing player.formationLoadout directly, and that the local draft cannot
// go stale against external writes.
//
// The Phaser preview region is mocked out: hosting mechanics belong to
// useDynamicRegion and are covered elsewhere; these tests exercise the
// draft/commit contract only.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TranPhapPanel from './TranPhapPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { TRAN_PHAP_FORMATIONS } from '@/data/formation/TranPhap'
import type { CompanionInstance } from '@/data/companion/Companions'
import { i18n } from '@/i18n'

vi.mock('@/presentation/host/useDynamicRegion', () => ({
  useDynamicRegion: () => ({
    generation: { value: 0 },
    bootError: { value: null },
    currentGeneration: () => 0,
    start: () => {},
    destroy: () => {},
    dispatch: () => {},
  }),
}))

function ownedCompanion(definitionId: string): CompanionInstance {
  return {
    instanceId: `inst-${definitionId}`,
    definitionId,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
  }
}

function mountPanel(prepare?: (deps: {
  gameManager: GameManager
  player: ReturnType<typeof usePlayerStore>
}) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const app = createApp({ render: () => h(TranPhapPanel) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  const player = usePlayerStore(pinia)

  gameManager.setActivePlayer(player.$state)

  prepare?.({ gameManager, player })

  app.mount(container)

  return {
    container,
    player,
    gameManager,
    ui: useUiStore(pinia),
    async open() {
      useUiStore(pinia).standalonePanel = 'tran_phap'
      await nextTick()
    },
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function formationButton(container: HTMLElement, formationId: string): HTMLButtonElement {
  const index = TRAN_PHAP_FORMATIONS.findIndex((f) => f.id === formationId)
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.tran-phap-panel__formation-button'),
  )

  expect(index).toBeGreaterThanOrEqual(0)
  expect(buttons.length).toBe(TRAN_PHAP_FORMATIONS.length)

  return buttons[index]!
}

function cells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.tran-phap-panel__cell'))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('TranPhapPanel', () => {
  it('commits the draft through the validating owner on confirm', async () => {
    const mounted = mountPanel()
    await mounted.open()

    formationButton(mounted.container, 'doc_hanh_tran').click()
    await nextTick()

    mounted.container.querySelector<HTMLButtonElement>('.tran-phap-panel__confirm')!.click()
    await nextTick()

    expect(mounted.player.formationLoadout).toEqual({
      formationId: 'doc_hanh_tran',
      assignments: [],
    })

    mounted.unmount()
  })

  it('leaves the committed loadout untouched when the owner rejects a stale draft', async () => {
    const committed = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 1, column: 0, combatantId: 'ho_ly_tinh' },
        { row: 1, column: 2, combatantId: 'player' },
      ],
    }

    const mounted = mountPanel(({ player }) => {
      player.companions = [ownedCompanion('ho_ly_tinh')]
      player.formationLoadout = committed
    })
    await mounted.open()

    const before = mounted.player.formationLoadout

    // The companion is released while the panel is open - the draft still
    // holds its assignment, so confirm must be rejected by the owner.
    mounted.player.companions = []
    await nextTick()

    mounted.container.querySelector<HTMLButtonElement>('.tran-phap-panel__confirm')!.click()
    await nextTick()

    expect(mounted.player.formationLoadout).toBe(before)
    expect(mounted.player.formationLoadout).toEqual(committed)

    mounted.unmount()
  })

  it('queue card for the player shows the entity-derived profile art, not a bare monogram', async () => {
    const mounted = mountPanel()
    await mounted.open()

    const card = mounted.container.querySelector<HTMLElement>('.tran-phap-panel__card')

    expect(card).not.toBeNull()

    const img = card!.querySelector<HTMLImageElement>('img.slot-view__item-icon')

    expect(img).not.toBeNull()
    expect(img!.getAttribute('src') ?? '').toContain(
      'player-mortal-ink-sword-concept-v2',
    )

    mounted.unmount()
  })

  it('resyncs the draft when formationLoadout changes externally while open', async () => {
    const mounted = mountPanel()
    await mounted.open()

    // No selection yet.
    expect(mounted.container.querySelector('.tran-phap-panel__formation-button.is-selected')).toBeNull()

    mounted.player.formationLoadout = {
      formationId: 'tam_tai_tran',
      assignments: [{ row: 0, column: 0, combatantId: 'player' }],
    }
    await nextTick()

    const selected = mounted.container.querySelector<HTMLElement>(
      '.tran-phap-panel__formation-button.is-selected',
    )

    expect(selected).not.toBeNull()
    expect(selected!.textContent ?? '').toContain(
      TRAN_PHAP_FORMATIONS.find((f) => f.id === 'tam_tai_tran')!.name,
    )

    // Local cell (0,0) is the first cell in DOM order.
    expect(cells(mounted.container)[0]!.textContent ?? '').toContain('player')

    mounted.unmount()
  })
})

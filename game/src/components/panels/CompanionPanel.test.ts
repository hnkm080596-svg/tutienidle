// @vitest-environment jsdom
// CompanionPanel (companion-gacha Task 10, 2026-09-12) - mounted-component
// tests over a real GameManager, same harness as RealmPanel.test.ts /
// ChiHienQuan.integration.test.ts: the panel self-gates on
// ui.standalonePanel === 'companion' and reads player.companions +
// materialBag through the provided keys.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import CompanionPanel from './CompanionPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { COMPANIONS } from '@/data/companion/Companions'
import type { CompanionInstance } from '@/data/companion/Companions'
import type { Material } from '@/core/material/Material'
import { COMMAND_WHEEL_SLOTS } from '@/data/ui/commandWheelCatalog'
import { REALMS } from '@/data/realms/realm'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

const FEED_MATERIAL: Material = {
  id: 'test_feed_material',
  name: 'Test Feed',
  category: 'other',
  sourceType: 'monster',
}

// In-scope categories but feed-excluded ids (currency / pull token).
const SPIRIT_STONE_STUB: Material = {
  id: 'spirit_stone_ha_pham',
  name: 'Test Spirit Stone',
  category: 'spirit_stone',
  sourceType: 'building',
}

const PULL_TOKEN_STUB: Material = {
  id: 'chieu_hien_lenh',
  name: 'Test Token',
  category: 'other',
  sourceType: 'boss',
}

const MORTAL_MAX_LEVEL = REALMS.find((realm) => realm.id === 'mortal')!.maxLevel

function ownedInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'inst-1',
    definitionId: COMPANIONS[0]!.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
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

  const app = createApp({ render: () => h(CompanionPanel) })

  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  const player = usePlayerStore(pinia)

  player.realmId = 'mortal'
  gameManager.setActivePlayer(player.$state)
  gameManager.catalogOps.registerMaterials([FEED_MATERIAL])

  useUiStore(pinia).standalonePanel = 'companion'

  // Panel computeds cache on stateVersion - bag contents must exist before
  // mount; player store fields are Pinia-reactive and can change anytime.
  prepare?.({ gameManager, player })

  app.mount(container)

  return {
    container,
    player,
    gameManager,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CompanionPanel', () => {
  it('renders owned companions grouped under their grade with a detail pane', () => {
    const mounted = mountPanel(({ player }) => {
      player.companions = [
        ownedInstance({ instanceId: 'inst-1', constellationRank: 2 }),
        ownedInstance({ instanceId: 'inst-2', definitionId: COMPANIONS[1]!.id }),
      ]
    })

    const cards = Array.from(mounted.container.querySelectorAll<HTMLElement>('.companion-panel__card'))

    expect(cards.length).toBe(2)
    expect(mounted.container.textContent ?? '').toContain(COMPANIONS[0]!.name)
    expect(mounted.container.textContent ?? '').toContain(COMPANIONS[1]!.name)

    // Detail pane defaults to the first companion: C-rank badge on the
    // card plus 6 pips with exactly constellationRank lit.
    const pips = Array.from(mounted.container.querySelectorAll<HTMLElement>('.companion-panel__pip'))

    expect(pips.length).toBe(6)
    expect(pips.filter((pip) => pip.classList.contains('is-lit')).length).toBe(2)
    expect(mounted.container.textContent ?? '').toContain('Phàm Nhân')

    mounted.unmount()
  })

  it('shows the empty state when the roster is empty', () => {
    const mounted = mountPanel()

    const empty = mounted.container.querySelector<HTMLElement>('.companion-panel__empty')

    expect(empty).not.toBeNull()
    expect(mounted.container.querySelector('.companion-panel__card')).toBeNull()

    mounted.unmount()
  })

  it('disables the feed button with a reason when the companion is level-maxed', () => {
    const mounted = mountPanel(({ player, gameManager }) => {
      // Player is mortal; a companion at mortal maxLevel sits at the
      // dynamic cap (isCompanionLevelMaxed).
      player.companions = [ownedInstance({ realmLevel: MORTAL_MAX_LEVEL })]
      gameManager.materialBag.add(FEED_MATERIAL, 5)
    })

    const button = mounted.container.querySelector<HTMLButtonElement>('.companion-panel__feed-button')

    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(true)
    expect(mounted.container.textContent ?? '').toContain('trần cảnh giới')

    mounted.unmount()
  })

  it('feeds a material stack through gameManager.feedCompanion', async () => {
    const mounted = mountPanel(({ player, gameManager }) => {
      player.companions = [ownedInstance()]
      gameManager.materialBag.add(FEED_MATERIAL, 5)
    })

    const button = mounted.container.querySelector<HTMLButtonElement>('.companion-panel__feed-button')!

    expect(button.disabled).toBe(false)

    button.click()
    await nextTick()

    // 1 x flat-10 exp against a 40-exp tier cost: no level-up, bag -1.
    expect(mounted.gameManager.materialBag.getAmount(FEED_MATERIAL.id)).toBe(4)
    expect(mounted.player.companions[0]!.exp).toBe(10)

    mounted.unmount()
  })

  it('lists only feedable materials in the feed picker', () => {
    const mounted = mountPanel(({ player, gameManager }) => {
      player.companions = [ownedInstance()]
      gameManager.materialRegistry.register(SPIRIT_STONE_STUB)
      gameManager.materialRegistry.register(PULL_TOKEN_STUB)
      gameManager.materialBag.add(FEED_MATERIAL, 5)
      gameManager.materialBag.add(SPIRIT_STONE_STUB, 5)
      gameManager.materialBag.add(PULL_TOKEN_STUB, 5)
    })

    const options = Array.from(
      mounted.container.querySelectorAll<HTMLOptionElement>('.companion-panel__feed-material option'),
    ).map((option) => option.value)

    expect(options).toEqual([FEED_MATERIAL.id])

    mounted.unmount()
  })

  it('command wheel entry resolves the standalone companion panel', () => {
    const slot = COMMAND_WHEEL_SLOTS.find((entry) => entry.id === 'companion_roster')

    expect(slot).toBeDefined()
    expect(slot!.target).toEqual({ kind: 'standalone', panel: 'companion' })
    expect(slot!.available()).toBe(true)
  })
})

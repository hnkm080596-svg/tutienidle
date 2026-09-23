// @vitest-environment jsdom
// M-F-BODY-PERFECTION (spec S6, plan Step 5.7) - the hidden surface:
// completely ABSENT before first discovery (the whole realm-panel col,
// not a hidden div), present after, partial discovery reveals only the
// FOUND ids, the perfect button mirrors canPerfectBodyRealm, and the
// perfected marker renders. Fixture registry via vi.mock (C2C r60-f4:
// production lists ship [], so there is no production injection seam).
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'

const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Record<string, readonly string[]> = {
  mortal: ['tinh_hoa_pham_the'],
  qi_refining: ['great_dao_seed', 'yeu_dan_hung_giao'],
  foundation_establishment: [],
  golden_core: [],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
}
  return { FIXTURE }
})

vi.mock('../../../data/realm/BodyPerfection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/realm/BodyPerfection')>()

  const byRealm = new Map(Object.entries(FIXTURE).map(([realm, ids]) => [realm, ids]))
  const realmOf = new Map<string, string>()
  for (const [realm, ids] of byRealm) {
    for (const id of ids) {
      realmOf.set(id, realm)
    }
  }

  return {
    ...actual,
    BODY_PERFECTION_REALM_MATERIALS: FIXTURE,
    bodyPerfectionMaterialIds: (realmId: string) => byRealm.get(realmId) ?? [],
    bodyPerfectionRealmOf: (materialId: string) => realmOf.get(materialId),
    isBodyPerfectionMaterial: (materialId: string) => realmOf.has(materialId),
  }
})

import RealmPanel from '../RealmPanel.vue'
import BodyPerfectionSection from './BodyPerfectionSection.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'
import { materials } from '@/data/materials/materials'
import type { Component } from 'vue'

function mountComponent(component: Component) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(component) })
  const pinia = createPinia()
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials(materials)
  const stateVersion = ref(0)
  const bumpState = vi.fn(() => {
    stateVersion.value += 1
  })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, bumpState)

  const player = usePlayerStore(pinia)
  app.mount(container)

  return {
    container,
    player,
    gameManager,
    bumpState,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function mountRealmPanel() {
  const mounted = mountComponent(RealmPanel)
  useUiStore().standalonePanel = 'realm'
  return mounted
}

const PERFECTION_TITLE = i18n.global.t('panels.realm.bodyPerfection.title')

describe('hidden surface gate (spec S6)', () => {
  it('renders NO perfection col before the first discovery - surface absent, not hidden', async () => {
    const mounted = mountRealmPanel()
    await nextTick()

    const cols = mounted.container.querySelectorAll('.realm-panel__body-col')
    expect(cols.length).toBe(3) // refinement + meridian + chu-thien only
    expect(mounted.container.querySelector('.body-perfection-section')).toBeNull()
    expect(mounted.container.textContent).not.toContain(PERFECTION_TITLE)

    mounted.unmount()
  })

  it('the col appears once the first material is discovered', async () => {
    const mounted = mountRealmPanel()
    mounted.player.$state.bodyPerfection.discoveredMaterials.push('tinh_hoa_pham_the')
    await nextTick()

    const cols = mounted.container.querySelectorAll('.realm-panel__body-col')
    expect(cols.length).toBe(4)
    expect(mounted.container.querySelector('.body-perfection-section')).not.toBeNull()
    expect(mounted.container.textContent).toContain(PERFECTION_TITLE)

    mounted.unmount()
  })
})

describe('BodyPerfectionSection rows', () => {
  it('partial discovery reveals only the FOUND materials - undiscovered requirements never leak', async () => {
    const mounted = mountComponent(BodyPerfectionSection)
    mounted.player.$state.realmId = 'qi_refining'
    // Discovered 1 of the 2 qi materials; nothing for mortal.
    mounted.player.$state.bodyPerfection.discoveredMaterials.push('great_dao_seed')
    await nextTick()

    const rows = mounted.container.querySelectorAll('.body-perfection-section__row')
    expect(rows.length).toBe(1)

    const text = mounted.container.textContent ?? ''
    const seedName = mounted.gameManager.materialRegistry.get('great_dao_seed').name
    expect(text).toContain(seedName)
    // The undiscovered sibling id never surfaces by name OR raw id.
    const hiddenName = mounted.gameManager.materialRegistry.get('yeu_dan_hung_giao').name
    expect(text).not.toContain(hiddenName)
    expect(text).not.toContain('yeu_dan_hung_giao')

    mounted.unmount()
  })

  it('button gates on canPerfectBodyRealm: disabled until discovered+owned, click perfects', async () => {
    const mounted = mountComponent(BodyPerfectionSection)
    const { player, gameManager, bumpState } = mounted
    player.$state.realmId = 'mortal'
    player.$state.bodyPerfection.discoveredMaterials.push('tinh_hoa_pham_the')
    await nextTick()

    const button = mounted.container.querySelector<HTMLButtonElement>(
      '.body-perfection-section__row-perfect button',
    )!
    expect(button).not.toBeNull()
    // Discovered but not owned -> disabled.
    expect(button.disabled).toBe(true)

    gameManager.materialBag.add(gameManager.materialRegistry.get('tinh_hoa_pham_the'), 1)
    bumpState()
    await nextTick()

    expect(button.disabled).toBe(false)

    button.click()
    await nextTick()

    expect(player.$state.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
    expect(bumpState).toHaveBeenCalled()
    // The row flips to the perfected marker and the button disappears.
    const row = mounted.container.querySelector('.body-perfection-section__row')!
    expect(row.classList.contains('body-perfection-section__row--perfected')).toBe(true)
    expect(row.textContent).toContain(i18n.global.t('panels.realm.bodyPerfection.statePerfected'))
    expect(row.querySelector('button')).toBeNull()

    mounted.unmount()
  })

  it('renders the perfected marker for a pre-perfected realm', async () => {
    const mounted = mountComponent(BodyPerfectionSection)
    mounted.player.$state.realmId = 'qi_refining'
    mounted.player.$state.bodyPerfection.discoveredMaterials.push('tinh_hoa_pham_the')
    mounted.player.$state.bodyPerfection.perfectedRealmIds.push('mortal')
    await nextTick()

    const row = mounted.container.querySelector('.body-perfection-section__row')!
    expect(row.classList.contains('body-perfection-section__row--perfected')).toBe(true)
    expect(row.textContent).toContain(i18n.global.t('panels.realm.bodyPerfection.statePerfected'))

    mounted.unmount()
  })
})

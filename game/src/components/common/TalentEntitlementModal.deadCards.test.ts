// @vitest-environment jsdom
//
// M-F-TALENT + C2C round 47 - the decision surface must never render a
// dead card: the persisted offer set is filtered through the same
// isLegalBreakthroughOffer predicate the resolver enforces, plus
// decision-time ownership. A foreign id, a retired def, or an already-
// owned offer is a choice the resolver rejects - it must not paint.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TalentEntitlementModal from './TalentEntitlementModal.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { i18n } from '@/i18n'

function mountModal(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    render: () => h('div', [h(TalentEntitlementModal)]),
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  app.mount(container)

  return {
    // SysModalBase teleports to body - query the document, not the container.
    card: (id: string) => document.body.querySelector(`[data-testid="entitlement-talent-${id}"]`),
    upgrade: (id: string) => document.body.querySelector(`[data-testid="entitlement-upgrade-${id}"]`),
    modal: () => document.body.querySelector('[data-testid="talent-entitlement-modal"]'),
    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('TalentEntitlementModal — no dead cards (C2C-47)', () => {
  let gameManager: GameManager
  let mounted: ReturnType<typeof mountModal>
  let player: ReturnType<typeof usePlayerStore>

  beforeEach(() => {
    gameManager = new GameManager()
    mounted = mountModal(gameManager)
    player = usePlayerStore()
  })

  afterEach(() => {
    mounted.unmount()
  })

  it('renders only live offers - foreign, retired, and already-owned ids never paint', async () => {
    // lk_linh_mach is owned (granted at level 1, legal next level) - it
    // belongs in the UPGRADE lane, never the NEW lane. tc_dia_can is a
    // catalog id from another realm's pool (foreign); 'retired_id'
    // resolves nothing.
    player.selectedTalentIds = ['lk_linh_mach']
    player.talentLevels = { lk_linh_mach: 1 }
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['lk_bac_hai', 'tc_dia_can', 'retired_id', 'lk_linh_mach'],
    }

    await nextTick()

    // The record stays actionable (one live NEW + one legal UPGRADE).
    expect(mounted.modal()).not.toBeNull()
    expect(mounted.card('lk_bac_hai')).not.toBeNull()

    // Dead cards: foreign pool member, unresolvable id, owned offer.
    expect(mounted.card('tc_dia_can')).toBeNull()
    expect(mounted.card('retired_id')).toBeNull()
    expect(mounted.card('lk_linh_mach')).toBeNull()

    // The owned talent still offers its legal UPGRADE lane.
    expect(mounted.upgrade('lk_linh_mach')).not.toBeNull()
  })

  it('a record whose offers all went dead reconciles away - no empty dialog', async () => {
    player.selectedTalentIds = ['lk_bac_hai', 'lk_tam_tue', 'lk_ngo_tinh']
    player.talentLevels = { lk_bac_hai: 3, lk_tam_tue: 3, lk_ngo_tinh: 3 }
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['lk_bac_hai', 'lk_tam_tue', 'lk_ngo_tinh'],
    }

    await nextTick()

    // Every offer is owned at max level (no legal next level) and no
    // other upgradeable talent exists - the record is unactionable and
    // the watchEffect reconcile clears it.
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(mounted.modal()).toBeNull()
  })
})

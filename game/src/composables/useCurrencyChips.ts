// Currency chip read-model (ui-audit economy H1) - the single source for
// "which counters does the home chrome show". Extracted from CurrencyHud
// so the fidelity DongFuHud and the legacy pill strip stay identical.
// Presentation only (A7): reads materialBag + player state through the
// stateVersion bridge; mutating commands stay in the ops layer.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { COMPANION_PULL_TOKEN_ID } from '@/core/game/GameManagerCompanionOps'
import { isBetaFeature } from '@/core/betaScope'
import { materialLabel } from '@/core/presentation/labels'

export interface CurrencyChip {
  id: string
  label: string
  amount: number
}

export function useCurrencyChips() {
  const { t } = useI18n()
  const player = usePlayerStore()
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  // Linh Thach is a per-realm-tier MATERIAL family (ha/trung/thuong pham),
  // not a scalar. Huyen Kim S03 (spec scene-03 top-bar): the strip shows
  // exactly the three tiers - empty tiers read 0 so the pill geometry is
  // stable and "I have no money at this tier" is always visible.
  const spiritStoneChips = computed<CurrencyChip[]>(() => {
    stateVersion.value

    return SPIRIT_STONE_MATERIALS.map((stone) => ({
      id: stone.id,
      label: stone.name,
      amount: gameManager.materialBag.getAmount(stone.id),
    }))
  })

  // Gacha currencies only render once the companion domain is reachable
  // (realm-gated in WorkerLodgePanel too - showing them earlier would be a
  // promise of a feature the player cannot open yet).
  // BETA SCOPE LOCK v2 (Phase-6): the companion domain is scope-hidden -
  // its currencies never surface in the HUD at any realm.
  const companionChips = computed<CurrencyChip[]>(() => {
    stateVersion.value

    if (!isBetaFeature('companion') || !isCompanionDomainUnlocked(player.realmId)) {
      return []
    }

    return [
      {
        id: COMPANION_PULL_TOKEN_ID,
        label: materialLabel(COMPANION_PULL_TOKEN_ID, gameManager.materialRegistry),
        amount: gameManager.materialBag.getAmount(COMPANION_PULL_TOKEN_ID),
      },
      {
        id: 'duyen_phan',
        label: t('duyenPhan.shortName'),
        amount: player.duyenPhan,
      },
    ]
  })

  const chips = computed(() => [...spiritStoneChips.value, ...companionChips.value])

  return { chips }
}

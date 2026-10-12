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
import {
  BUI_GO_ID,
  LUYEN_DAN_TINH_HOA_ID,
  LUYEN_KHI_TINH_HOA_ID,
} from '@/core/equipment/TinhHoaMaterial'

const MATERIAL_CHIP_IDS = [BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID, LUYEN_KHI_TINH_HOA_ID] as const

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

  // Linh Thach is a MATERIAL, not a scalar. Flatten (2026-10-11, owner
  // ruling): one spirit stone, no ha/trung/thuong tiers - the strip shows
  // a single chip from SPIRIT_STONE_MATERIALS.
  const spiritStoneChips = computed<CurrencyChip[]>(() => {
    stateVersion.value

    return SPIRIT_STONE_MATERIALS.map((stone) => ({
      id: stone.id,
      label: stone.name,
      amount: gameManager.materialBag.getAmount(stone.id),
    }))
  })

  // Materials-rework outputs (2026-10-11): the three universal
  // by-products the closed loop produces - shown on the DongFu chrome
  // next to Linh Thach so decompose/dissolve sinks are always visible.
  const materialChips = computed<CurrencyChip[]>(() => {
    stateVersion.value

    return MATERIAL_CHIP_IDS.map((id) => ({
      id,
      label: materialLabel(id, gameManager.materialRegistry),
      amount: gameManager.materialBag.getAmount(id),
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

  // Cam Ngo Ky Nang (2026-10-12, Minh ruling): skill-upgrade currency is a
  // player scalar, not a material - minted from combat only. Shown so the
  // strip advertises where skill nodes get paid.
  const insightChips = computed<CurrencyChip[]>(() => {
    stateVersion.value
    return [
      {
        id: 'skill_insight',
        label: t('combat.rewards.skillInsight'),
        amount: player.skillInsight,
      },
    ]
  })

  const chips = computed(() => [
    ...spiritStoneChips.value,
    ...materialChips.value,
    ...insightChips.value,
    ...companionChips.value,
  ])

  return { chips }
}

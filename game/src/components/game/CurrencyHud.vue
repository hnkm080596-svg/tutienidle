<script setup lang="ts">
// Currency HUD (ui-audit economy H1, 2026-09-28) - a persistent strip of
// the currencies the economy actually spends, pinned to the top-left of
// the Dong Fu home chrome (mirrors AutoFarmIndicator's top-right chip).
// Before this, Linh Thach / Chieu Hien Lenh / Duyen Phan balances were
// only visible inside deep panels, so players could not answer "how much
// money do I have" from the home screen.
//
// Presentation only (A7): reads materialBag + player state through the
// stateVersion bridge; mutating commands stay in the ops layer. The
// 1-second App.vue tick keeps the counts live.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { chromeSlice } from '@/ui/huyenKimChrome'
import DongFuResourcePill from '@/components/scenes/dong-fu/hud/DongFuResourcePill.vue'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { COMPANION_PULL_TOKEN_ID } from '@/core/game/GameManagerCompanionOps'
import { isBetaFeature } from '@/core/betaScope'
import { materialLabel } from '@/core/presentation/labels'
import { formatNumber } from '@/core/format/NumberFormatter'

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

interface CurrencyChip {
  id: string
  label: string
  amount: number
}

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

// Huyen Kim chrome slot `resource-pill` (160x48, non-tintable) is spec'd
// for these counters. While the manifest keeps the slot 'pending',
// chromeSlice() returns null and the chips keep the CSS capsule below;
// once 'ready', InkNineSlice (the ONE nine-slice owner) paints the PNG -
// manifest-only change, no code edits (huyen-kim-chrome.json contract).
const resourcePillSlice = chromeSlice('resource-pill')
</script>

<template>
  <div class="currency-hud" :aria-label="t('currencyHud.aria')" data-hk-region="resource-cluster">
    <DongFuResourcePill
      v-for="chip in chips"
      :key="chip.id"
      :chip-id="chip.id"
      :label="chip.label"
      :amount-text="formatNumber(chip.amount)"
      :sliced="Boolean(resourcePillSlice)"
    />
  </div>
</template>

<style scoped>
.currency-hud {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  /* Above building hotspots (5) and the command wheel (8), below the
     panel drawers (10) and overlay scrims - panels still cover it. */
  z-index: 9;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: 60vw;
  pointer-events: none;
}

/* Chip internals (pill surface, label, amount) live in
   DongFuResourcePill - this block owns only the strip layout. */
</style>

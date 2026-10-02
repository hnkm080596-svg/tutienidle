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
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
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
  <div class="currency-hud" :aria-label="t('currencyHud.aria')">
    <span
      v-for="chip in chips"
      :key="chip.id"
      class="currency-hud__chip"
      :class="[`currency-hud__chip--${chip.id}`, { 'currency-hud__chip--sliced': Boolean(resourcePillSlice) }]"
    >
      <InkNineSlice v-if="resourcePillSlice" chrome-id="resource-pill" layer="surface" />
      <span class="currency-hud__label">{{ chip.label }}</span>
      <strong class="currency-hud__amount">{{ formatNumber(chip.amount) }}</strong>
    </span>
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

.currency-hud__chip {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--ink-950) 80%, transparent);
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--surface-text-soft);
}

/* Sliced capsule: the resource-pill PNG owns fill + ring, so the CSS
   capsule surface drops out and the slice inherits the chip radius. */
.currency-hud__chip--sliced {
  background: none;
  border-color: transparent;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
}

.currency-hud__label,
.currency-hud__amount {
  position: relative;
  z-index: 3;
}

.currency-hud__label {
  font-size: var(--text-xs);
  white-space: nowrap;
}

.currency-hud__amount {
  color: var(--surface-text);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.currency-hud__chip--duyen_phan .currency-hud__amount {
  color: var(--mineral-gold);
}
</style>

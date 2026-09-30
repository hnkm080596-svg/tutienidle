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
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import { isCompanionGameplayUnlocked } from '@/core/companion/CompanionAvailability'
import { COMPANION_PULL_TOKEN_ID } from '@/core/game/GameManagerCompanionOps'
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
// not a scalar - show one chip per tier the player actually holds, plus
// the current realm's tier even at 0 so "I have no money" is visible.
const spiritStoneChips = computed<CurrencyChip[]>(() => {
  stateVersion.value

  const chips = SPIRIT_STONE_MATERIALS.map((stone) => ({
    id: stone.id,
    label: stone.name,
    amount: gameManager.materialBag.getAmount(stone.id),
  }))

  const held = chips.filter((chip) => chip.amount > 0)

  // Empty bag still needs a visible zero balance - fall back to the
  // lowest tier so the strip is never empty.
  return held.length > 0 ? held : chips.slice(0, 1)
})

// Gacha currencies only render once the companion domain is reachable
// (realm-gated in WorkerLodgePanel too - showing them earlier would be a
// promise of a feature the player cannot open yet).
const companionChips = computed<CurrencyChip[]>(() => {
  stateVersion.value

  // BETA-SCOPE-LOCK - the gameplay authority (realm gate AND scope
  // flag): gacha currency chips must not promise a feature that is
  // locked in this build.
  if (!isCompanionGameplayUnlocked(player.realmId)) {
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
</script>

<template>
  <div class="currency-hud" :aria-label="t('currencyHud.aria')">
    <span
      v-for="chip in chips"
      :key="chip.id"
      class="currency-hud__chip"
      :class="`currency-hud__chip--${chip.id}`"
    >
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

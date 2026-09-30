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
import { computed, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { chromeSlice, HUYEN_KIM_CHROME } from '@/ui/huyenKimChrome'
import { SPIRIT_STONE_MATERIALS } from '@/core/material/SpiritStoneMaterial'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
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

  if (!isCompanionDomainUnlocked(player.realmId)) {
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
// chromeSlice() returns null and the chips keep the CSS capsule below -
// identical render to today. Once the PNG drops and status flips to
// 'ready', this style paints the nine-slice instead: manifest-only
// change, no code edits (huyen-kim-chrome.json header contract).
const resourcePill = HUYEN_KIM_CHROME['resource-pill']
const resourcePillSlice = chromeSlice('resource-pill')

const chipChromeStyle = computed<CSSProperties[] | undefined>(() => {
  if (!resourcePill || !resourcePillSlice) return undefined

  const { url1x, url2x, slices } = resourcePillSlice
  // Render at the manifest's minimumHeight/sourceHeight ratio (the pill
  // capsule art is authored for ~0.5x source). image-set reports each
  // candidate's intrinsic size in density-aware CSS px, so the same px
  // slice numbers cut correctly on the 2x sheet; the plain url() entry
  // keeps engines without image-set support working.
  const scale = resourcePill.minimumHeight / resourcePill.sourceHeight
  const fill = resourcePill.center === 'transparent' ? '' : ' fill'
  const slice = `${slices.top} ${slices.right} ${slices.bottom} ${slices.left}${fill}`
  const width =
    `${slices.top * scale}px ${slices.right * scale}px ` +
    `${slices.bottom * scale}px ${slices.left * scale}px`
  return [
    {
      borderStyle: 'solid',
      borderWidth: width,
      borderColor: 'transparent',
      borderRadius: '0px',
      background: 'none',
      borderImageSource: `url("${url1x}")`,
      borderImageSlice: slice,
      borderImageWidth: width,
      borderImageRepeat: resourcePill.edgeMode === 'tile' ? 'repeat' : 'stretch',
    },
    { borderImageSource: `image-set(url("${url1x}") 1x, url("${url2x}") 2x)` },
  ]
})
</script>

<template>
  <div class="currency-hud" :aria-label="t('currencyHud.aria')">
    <span
      v-for="chip in chips"
      :key="chip.id"
      class="currency-hud__chip"
      :class="[`currency-hud__chip--${chip.id}`, { 'currency-hud__chip--sliced': Boolean(resourcePillSlice) }]"
      :style="chipChromeStyle"
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

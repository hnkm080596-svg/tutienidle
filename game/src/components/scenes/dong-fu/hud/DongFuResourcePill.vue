<script setup lang="ts">
// One resource pill (scene 03 spec `resource-cluster` child): a single
// currency capsule in the top-bar strip. The `resource-pill` chrome
// nine-slice owns the capsule face when the slot is ready; the CSS
// capsule below is the pending/fallback path.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

defineProps<{
  chipId: string
  label: string
  amountText: string
  /** True when chromeSlice('resource-pill') resolves (slot ready). */
  sliced: boolean
}>()
</script>

<template>
  <span
    class="currency-hud__chip"
    :class="[`currency-hud__chip--${chipId}`, { 'currency-hud__chip--sliced': sliced }]"
    :art-needed="!sliced"
    data-art-id="resource-pill"
  >
    <InkNineSlice v-if="sliced" chrome-id="resource-pill" layer="surface" />
    <span class="currency-hud__label">{{ label }}</span>
    <strong class="currency-hud__amount">{{ amountText }}</strong>
  </span>
</template>

<style scoped>
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

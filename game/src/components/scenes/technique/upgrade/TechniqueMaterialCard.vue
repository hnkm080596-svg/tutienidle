<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import { formatNumber } from '@/core/format/NumberFormatter'

// One material row in the upgrade panel: slot-framed icon cell, material
// name, and owned/needed count (red when insufficient). The model quotes
// at most ONE material per advance - the ref's extra Linh Thach card has
// no data source (flagged in report).
const props = defineProps<{
  name: string
  owned: number
  cost: number
}>()

const rowSlice = computed(() => chromeSlice('list-row'))
const slotSlice = computed(() => chromeSlice('frame-s-slot'))
const insufficient = computed(() => props.owned < props.cost)
</script>

<template>
  <div
    class="technique-material-card"
    :class="{ 'is-insufficient': insufficient }"
    :art-needed="!rowSlice || undefined"
    data-art-id="list-row"
  >
    <InkNineSlice chrome-id="list-row" layer="surface" />
    <span
      class="technique-material-card__icon"
      :art-needed="!slotSlice || undefined"
      data-art-id="frame-s-slot"
      aria-hidden="true"
    >
      <InkNineSlice chrome-id="frame-s-slot" layer="frame" />
      <span class="technique-material-card__icon-glyph">◆</span>
    </span>
    <span class="technique-material-card__name">{{ name }}</span>
    <span class="technique-material-card__count">
      {{ formatNumber(owned) }} / {{ formatNumber(cost) }}
    </span>
  </div>
</template>

<style scoped>
.technique-material-card {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: var(--hk-space-3);
  padding: var(--hk-space-2) var(--hk-space-3);
}

.technique-material-card > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-material-card__icon {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: var(--hk-surface-raised);
  border-radius: var(--hk-radius-sm);
}

.technique-material-card__icon > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-material-card__icon-glyph {
  color: var(--hk-jade);
  font-size: var(--text-body);
}

.technique-material-card__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--hk-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.technique-material-card__count {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--hk-text-secondary);
  flex-shrink: 0;
}

.technique-material-card.is-insufficient .technique-material-card__count {
  color: var(--hk-cinnabar);
  font-weight: 600;
}
</style>

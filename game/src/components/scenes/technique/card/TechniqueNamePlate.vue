<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'

// Left-card identity block: display name + red quality seal chip +
// "Phẩm: <quality>" line, matching ref rows 2-3 of the tech card.
// Quality label/key arrive pre-resolved (model quality -> labels).
defineProps<{
  name: string
  qualityKey: string
  qualityLabel: string
  qualityLine: string
}>()

const sealSlice = computed(() => chromeSlice('seal-chip'))
</script>

<template>
  <div class="technique-name-plate">
    <div class="technique-name-plate__row">
      <h3 class="technique-name-plate__name">{{ name }}</h3>
      <span
        class="technique-name-plate__seal"
        :class="`technique-name-plate__seal--${qualityKey}`"
        :art-needed="!sealSlice || undefined"
        data-art-id="seal-chip"
      >
        <InkNineSlice chrome-id="seal-chip" layer="frame" />
        <span class="technique-name-plate__seal-text">{{ qualityLabel }}</span>
      </span>
    </div>
    <p class="technique-name-plate__quality">{{ qualityLine }}</p>
  </div>
</template>

<style scoped>
.technique-name-plate__row {
  display: flex;
  align-items: center;
  gap: var(--hk-space-3);
  min-width: 0;
}

.technique-name-plate__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  color: var(--hk-gold-bright);
  line-height: 1.2;
}

.technique-name-plate__seal {
  position: relative;
  isolation: isolate;
  flex-shrink: 0;
  padding: 3px var(--hk-space-2);
}

.technique-name-plate__seal > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.technique-name-plate__seal-text {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hk-cinnabar);
  /* Temp art: seal tint lives on the chip until the seal-chip drop. */
  --chip-active-bg: var(--hk-cinnabar);
}

.technique-name-plate__quality {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--hk-text-secondary);
}
</style>

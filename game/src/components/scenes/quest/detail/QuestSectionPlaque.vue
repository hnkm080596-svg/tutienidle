<script setup lang="ts">
// Section plaque shared by the detail panel's checklist and reward
// sections: the ref's hanging tab header (Muc Tieu Nhiem Vu / Thuong
// Nhiem Vu). Reuses the section-plaque chrome slot, token fallback
// while the art is pending.
import { computed } from 'vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'

defineProps<{ text: string }>()

const plaqueSlice = computed(() => chromeSlice('section-plaque'))
</script>

<template>
  <h3 class="quest-section-plaque">
    <InkNineSlice
      chrome-id="section-plaque"
      layer="frame"
      class="quest-section-plaque__chrome"
      :art-needed="!plaqueSlice || undefined"
      data-art-id="section-plaque"
    />
    <span class="quest-section-plaque__text">{{ text }}</span>
  </h3>
</template>

<style scoped>
.quest-section-plaque {
  position: relative;
  isolation: isolate;
  align-self: flex-start;
  margin: 0;
  padding: 3px 14px;
}

.quest-section-plaque__text {
  position: relative;
  z-index: 1;
  font: 700 var(--text-sm) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.06em;
  color: var(--hk-gold, #e3bd67);
}
</style>

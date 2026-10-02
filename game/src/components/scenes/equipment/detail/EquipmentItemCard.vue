<script setup lang="ts">
// Item card region (spec region item-card, 330 x 610): surface-m-panel
// chrome hosting the selected item detail in Trang Bi mode or the active
// op workspace when a rail seal is picked (spec purpose "detail + ops").
// Scrollfade per spec overflow rule; the narrow column is its own
// container so .qi-hall__split stacks inside it (qi-hall.css).
import { computed } from 'vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'

defineProps<{
  title?: string
}>()

const panelSlice = computed(() => chromeSlice('surface-m-panel'))
</script>

<template>
  <article class="equipment-item-card" data-hk-region="item-card">
    <!-- InkNineSlice keeps a token fallback under pending art; art-needed
         marks the surface while the slice is absent. -->
    <InkNineSlice
      chrome-id="surface-m-panel"
      layer="surface"
      class="equipment-item-card__surface"
      :art-needed="!panelSlice || undefined"
      data-art-id="surface-m-panel"
    />

    <p v-if="title" class="equipment-item-card__title">{{ title }}</p>
    <div class="equipment-item-card__body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.equipment-item-card {
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.equipment-item-card > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.equipment-item-card__title {
  flex: 0 0 auto;
  margin: 12px 14px 0;
  padding-left: 10px;
  border-left: 3px solid var(--hk-gold-muted, #b99a55);
  font: 700 var(--text-title, 15px) var(--hk-font-display, var(--font-display));
  color: var(--hk-gold-bright, var(--hk-gold, #e3bd67));
  letter-spacing: 0.06em;
}

.equipment-item-card__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  container: equipment-ops / inline-size;
}
.equipment-item-card__body::-webkit-scrollbar { display: none; }
</style>

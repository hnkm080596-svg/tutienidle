<script setup lang="ts">
// Scene 07 detail-panel region (spec: 1172/176/360/610, shell-panel
// family, surface-m-panel + seal-chip + list-row + button-ceremonial;
// scrollfade overflow). One dark parchment rail framing the node
// inspector and the active-arts strip.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
</script>

<template>
  <aside class="skill-scene__detail" data-hk-region="detail-panel">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <div class="skill-scene__detail-inner">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.skill-scene__detail {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.skill-scene__detail-inner {
  position: relative;
  z-index: 3;
  /* Border-box so the 14px padding counts inside the rail height -
     content-box made the column 28px taller than the aside and pushed
     it (plus the parent column's scroll range) past the card's bottom. */
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* Top pad clears the 12px scrollfade plus the panel's ~24px top
     ornament band so the col title starts below the frame art. */
  padding: 26px 12px 14px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
}
.skill-scene__detail-inner::-webkit-scrollbar { display: none; }
</style>

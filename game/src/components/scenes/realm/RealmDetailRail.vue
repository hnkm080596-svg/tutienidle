<script setup lang="ts">
// Scene 05 right rail (spec x1116 w416 stack): one dark parchment panel
// (surface-m-panel chrome) framing the realm card, cultivation bar,
// passives and action regions. Scrollfade overflow per spec.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
</script>

<template>
  <aside class="realm-scene__rail">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <div class="realm-scene__rail-inner">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.realm-scene__rail {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 0;
}
.realm-scene__rail-inner {
  position: relative;
  z-index: 3;
  /* height:100% + border-box so padding stays inside the painted rail;
     otherwise the inner box overflows the card by the pad and the
     rail-bottom CTA (Quan Khi) renders outside the frame (D-M5). */
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* Bottom pad > fade depth: the CTA must end fully inside the opaque
     band, not under the scrollfade. */
  padding: 16px 14px 24px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 8px), transparent 100%);
}
.realm-scene__rail-inner::-webkit-scrollbar { display: none; }
</style>

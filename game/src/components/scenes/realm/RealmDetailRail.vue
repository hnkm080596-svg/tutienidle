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
  /* spec gap 8 design px of the ~656 rail band -> 1.22% resolves
     against the rail HEIGHT (row gaps resolve on the block axis). */
  gap: 1.22%;
  /* Envelope-unit pads: rail sub-stack sits +29..+43 low at 2.5cqh top,
     so the top pad drops to ~1.2cqh; the bottom pad covers the fade
     depth AND the sticky CTA's docked room, so Quan Khi always ends
     inside the opaque band, not under the scrollfade. */
  padding: 1.2cqh 1.42cqw 7.5cqh;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 8px), transparent 100%);
}
.realm-scene__rail-inner::-webkit-scrollbar { display: none; }
</style>

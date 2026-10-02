<script setup lang="ts">
// Scene 02 scroll shell - the imperial scroll the creation form lives on.
// Chrome = delivered surface-xl-scroll + frame-xl-ceremony slices; the
// carved ornaments (lantern, tassel, corners) hang outside the ring.
// Interior slots follow the spec's region order.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import CreationScrollOrnaments from './CreationScrollOrnaments.vue'
</script>

<template>
  <section class="creation-scroll" data-hk-region="creation-card">
    <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
    <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
    <CreationScrollOrnaments />
    <div class="creation-scroll__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.creation-scroll {
  position: absolute;
  inset: 0;
  isolation: isolate;
}

.creation-scroll__body {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  /* spec padding 40 design px on a 660x760 scroll: 40/941 = 4.25vh,
     40/660 = 6.06% */
  padding: clamp(18px, 4.25vh, 42px) clamp(22px, 6.06%, 42px);
  overflow-y: auto;
  scrollbar-width: none;
}

.creation-scroll__body::-webkit-scrollbar {
  display: none;
}
</style>

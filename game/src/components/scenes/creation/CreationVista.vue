<script setup lang="ts">
// Scene 02 vista region — the painted world left of the creation scroll.
// Layer order (bottom→top): parallax stack (delivered stable art) → ink
// edge fade → seated figure → desk props. Decorative only.
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
import CreationVistaFigure from './CreationVistaFigure.vue'
import CreationVistaDesk from './CreationVistaDesk.vue'
import CreationVistaBanner from './CreationVistaBanner.vue'
</script>

<template>
  <div class="creation-vista" aria-hidden="true">
    <HuyenKimParallaxStack stack="auth-creation" />
    <div class="creation-vista__inkfade" />
    <CreationVistaBanner />
    <CreationVistaFigure />
    <CreationVistaDesk />
  </div>
</template>

<style scoped>
.creation-vista {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* Soft ink wash where the scroll meets the vista so the panel seam reads
   carved-in rather than pasted on (ref: mist drifts behind the scroll). */
.creation-vista__inkfade {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 46%;
  background: linear-gradient(90deg, transparent, rgba(16, 23, 24, 0.42) 68%, rgba(16, 23, 24, 0.6));
  pointer-events: none;
}
</style>

<script setup lang="ts">
// Static night-sky backdrop for a constellation panel (plan sec.7):
// the commissioned skill-tree vista layers plus a faint Han-glyph
// watermark. Deliberately no continuous animation - the panel must not
// pay a permanent CPU cost for ambience.
import { stableParallaxStack } from '@/presentation/huyenKim/StableSceneArt'

defineProps<{ glyph: string }>()

const layers = stableParallaxStack('skill-tree')
</script>

<template>
  <div class="constellation-backdrop" aria-hidden="true">
    <img
      v-for="layer in layers"
      :key="layer.assetId"
      class="backdrop-layer"
      :src="layer.src1x"
      :srcset="`${layer.src1x} 1x, ${layer.src2x} 2x`"
      alt=""
    >
    <span class="backdrop-glyph">{{ glyph }}</span>
    <div class="backdrop-vignette" />
  </div>
</template>

<style scoped>
.constellation-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 10px;
  background: #0b1220;
}
.backdrop-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.backdrop-glyph {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display, Georgia, serif);
  font-size: 230px;
  line-height: 1;
  color: #e8d49a;
  opacity: 0.06;
  pointer-events: none;
}
.backdrop-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 52%, rgba(8, 12, 22, 0.85) 100%);
}
</style>

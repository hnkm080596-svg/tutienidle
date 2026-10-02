<script setup lang="ts">
// HuyenKimParallaxStack - the ONE reusable presenter for the stable-art
// parallax stacks (auth-creation, realm-ascent, skill-tree). Contract:
// - layers render in manifest order on one shared canvas + center;
// - cover fit + centered overscan >= 2 * max_drift_px per axis;
// - bounded normalized pointer input; offset = -pointer * maxDrift,
//   hard-clamped to the layer's rendered max;
// - prefers-reduced-motion: every offset is exactly 0 (jsdom-safe via
//   matchMedia guard).
// Decorative substrate only: aria-hidden, pointer-events none, no text.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  stableParallaxStack,
  type StableParallaxStackId,
} from '@/presentation/huyenKim/StableSceneArt'
import {
  clampUnit,
  layerFrame,
  parallaxOffset,
} from '@/presentation/huyenKim/parallaxMath'

const props = defineProps<{ stack: StableParallaxStackId }>()

const layers = computed(() => stableParallaxStack(props.stack))

const rootEl = ref<HTMLElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })
const pointer = ref({ x: 0, y: 0 })
const reducedMotion = ref(false)

let resizeObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined

function layerStyle(index: number) {
  const layer = layers.value[index]
  if (!layer) {
    return {}
  }
  const frame = layerFrame(containerSize.value.width, containerSize.value.height, {
    width: layer.width,
    height: layer.height,
    maxDriftPx: layer.parallax.maxDriftPx,
  })
  const offset = parallaxOffset(pointer.value.x, pointer.value.y, frame, reducedMotion.value)

  return {
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    transform: `translate(-50%, -50%) translate3d(${offset.x}px, ${offset.y}px, 0)`,
    zIndex: index,
  }
}

function handlePointerMove(event: PointerEvent): void {
  if (reducedMotion.value) {
    return
  }
  pointer.value = {
    x: clampUnit((event.clientX / window.innerWidth - 0.5) * 2),
    y: clampUnit((event.clientY / window.innerHeight - 0.5) * 2),
  }
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
  if (event.matches) {
    pointer.value = { x: 0, y: 0 }
  }
}

function observeSize(): void {
  const el = rootEl.value
  if (!el) {
    return
  }
  containerSize.value = {
    width: el.clientWidth,
    height: el.clientHeight,
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        containerSize.value = { width: rect.width, height: rect.height }
      }
    })
    resizeObserver.observe(el)
  }
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotion.value = reducedMotionQuery?.matches ?? false
  reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  observeSize()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange)
  window.removeEventListener('pointermove', handlePointerMove)
})
</script>

<template>
  <div
    ref="rootEl"
    class="hk-parallax-stack"
    :class="{ 'is-reduced-motion': reducedMotion }"
    :data-stack="stack"
    aria-hidden="true"
  >
    <img
      v-for="(layer, index) in layers"
      :key="layer.assetId"
      class="hk-parallax-stack__layer"
      :data-layer="layer.assetId"
      :data-depth="layer.parallax.depth"
      :data-order="layer.parallax.order"
      :data-motion="layer.parallax.motion"
      :src="layer.src1x"
      :srcset="`${layer.src1x} 1x, ${layer.src2x} 2x`"
      :style="layerStyle(index)"
      alt=""
      draggable="false"
      decoding="async"
    />
  </div>
</template>

<style scoped>
.hk-parallax-stack {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /* Contain the layers' z-order: without a stacking context the imgs'
     inline z-index 0..5 escape into the parent context and paint over
     content siblings (e.g. the auth card at z-index 1). */
  isolation: isolate;
  z-index: 0;
}

/* Shared cover geometry: each layer is a fixed-size element centered in the
   container (frame already includes centered overscan), translated by drift. */
.hk-parallax-stack__layer {
  position: absolute;
  left: 50%;
  top: 50%;
  user-select: none;
  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .hk-parallax-stack__layer {
    transition: none;
  }
}
</style>

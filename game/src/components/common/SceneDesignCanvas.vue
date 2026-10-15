<script setup lang="ts">
import { GAME_UI_WIDTH, GAME_UI_HEIGHT } from '@/presentation/geometry/GameUiFrame'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'

const props = withDefaults(defineProps<{ width?: number; height?: number; overlay?: boolean }>(), { width: GAME_UI_WIDTH, height: GAME_UI_HEIGHT, overlay: false })
const emit = defineEmits<{ layout: [] }>()
const viewport = useTemplateRef<HTMLElement>('viewport')
const scale = shallowRef(1)
let observer: ResizeObserver | undefined
const canvasStyle = computed(() => ({
  width: `${props.width}px`, height: `${props.height}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))
function measure() {
  if (!viewport.value) return
  const width = viewport.value.clientWidth
  const height = viewport.value.clientHeight
  if (width <= 0 || height <= 0) return
  scale.value = Math.min(width / props.width, height / props.height)
  void nextTick(() => emit('layout'))
}
onMounted(() => {
  measure()
  // jsdom test envs ship no ResizeObserver - the canvas just stays at
  // scale 1 there (tests assert content, not scaling geometry).
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (viewport.value) observer.observe(viewport.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="viewport" class="scene-viewport" :class="{ 'scene-viewport--overlay': props.overlay }" data-testid="scene-viewport">
    <div class="scene-design-canvas" :style="canvasStyle" :data-scale="scale">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.scene-viewport { position: fixed; inset: 0; overflow: hidden; background: #111c21; }
/* Overlay variant: panel surfaces (paper on Dong Fu) stack a second
   scaled canvas above the stage. Transparent + click-through - the
   surface root re-enables pointer events for its own regions. */
.scene-viewport--overlay { background: transparent; pointer-events: none; }
.scene-viewport--overlay .scene-design-canvas { pointer-events: none; }
.scene-design-canvas { position: absolute; left: 50%; top: 50%; transform-origin: center; overflow: hidden; isolation: isolate; }
</style>

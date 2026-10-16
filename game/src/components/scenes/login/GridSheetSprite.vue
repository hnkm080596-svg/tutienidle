<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { prepareRenderedImage } from '@/presentation/assets/prepareRenderedImage'
import { prefersReducedMotion } from '@/presentation/motionPreference'

const props = defineProps<{
  src: string
  columns: number
  rows: number
  frameWidth: number
  frameHeight: number
  fps: number
}>()
const image = useTemplateRef<HTMLImageElement>('image')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const geometry = computed(() => ({ aspectRatio: `${props.frameWidth} / ${props.frameHeight}` }))
let raf = 0
let disposed = false
let prepared = false
let start = 0
let lastFrame = -1
let observer: MutationObserver | undefined
let media: MediaQueryList | undefined

function draw(frame: number): void {
  const context = canvas.value?.getContext('2d')
  if (!context || !image.value || image.value.naturalWidth === 0) return
  context.clearRect(0, 0, props.frameWidth, props.frameHeight)
  context.imageSmoothingEnabled = false
  context.drawImage(image.value,
    frame % props.columns * props.frameWidth, Math.floor(frame / props.columns) * props.frameHeight,
    props.frameWidth, props.frameHeight, 0, 0, props.frameWidth, props.frameHeight)
  lastFrame = frame
}
function tick(now: number): void {
  if (disposed) return
  if (start === 0) start = now
  const frame = Math.floor((now - start) * props.fps / 1000) % (props.columns * props.rows)
  if (frame !== lastFrame) draw(frame)
  raf = requestAnimationFrame(tick)
}
function updatePlayback(): void {
  cancelAnimationFrame(raf)
  raf = 0
  start = 0
  if (!prepared || disposed) return
  draw(0)
  if (!prefersReducedMotion() && !document.hidden) raf = requestAnimationFrame(tick)
}
function imageLoaded(): void {
  if (disposed) return
  prepared = true
  updatePlayback()
}
async function prepare(signal: AbortSignal): Promise<void> {
  await prepareRenderedImage(image.value, signal)
  if (disposed || signal.aborted) throw new DOMException('Sprite preparation aborted', 'AbortError')
  prepared = true
  updatePlayback()
}
onMounted(() => {
  media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener('change', updatePlayback)
  observer = new MutationObserver(updatePlayback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
  document.addEventListener('visibilitychange', updatePlayback)
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  observer?.disconnect()
  media?.removeEventListener('change', updatePlayback)
  document.removeEventListener('visibilitychange', updatePlayback)
})
defineExpose({ prepare })
</script>

<template>
  <span class="grid-sheet-sprite" :style="geometry" aria-hidden="true">
    <img ref="image" class="grid-sheet-sprite__source" :src="src" alt="" draggable="false" @load="imageLoaded">
    <canvas ref="canvas" class="grid-sheet-sprite__canvas" :width="frameWidth" :height="frameHeight" />
  </span>
</template>

<style scoped>
.grid-sheet-sprite { position: relative; display: block; overflow: hidden; pointer-events: none; user-select: none; }
.grid-sheet-sprite__source { display: none; }
.grid-sheet-sprite__canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
</style>


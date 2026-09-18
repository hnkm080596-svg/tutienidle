<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// EntitySpriteCanvas — Vue-side sprite animation over a TexturePacker atlas.
// Exists because Vue panels can't play Phaser animations: this component
// fetches the atlas JSON + PNG once and steps frames on a rAF interval. Only
// rendered when ENTITY_ART_MODE === 'animated' (callers gate on the constant).
//
// Reads both atlas layouts Phaser consumes: a single atlas's JSON-Hash
// (`frames` keyed by filename) and a multiatlas's array-of-textures
// (`textures[i].frames` entries carry a `filename`). Frames are drawn at
// their `spriteSourceSize` offset inside the `sourceSize` box so a trimmed
// animation stays planted instead of jittering.
export interface EntitySpriteCanvasProps {
  sheetUrl: string
  atlasUrl: string
  framePrefix: string
  frameSuffix: string
  zeroPad: number
  firstFrame: number
  lastFrame: number
  fps: number
  height?: number | string
}

const props = withDefaults(defineProps<EntitySpriteCanvasProps>(), { height: 239 })

const canvasEl = ref<HTMLCanvasElement | null>(null)
let rafId = 0
let lastStep = 0
let frameIndex = props.firstFrame
let disposed = false

interface PackedFrame {
  frame: { x: number; y: number; w: number; h: number }
  spriteSourceSize: { x: number; y: number }
  sourceSize: { w: number; h: number }
}

function frameName(i: number): string {
  return `${props.framePrefix}${String(i).padStart(props.zeroPad, '0')}${props.frameSuffix}`
}

function frameTable(atlas: Record<string, unknown>): Record<string, PackedFrame> {
  if (atlas.frames && typeof atlas.frames === 'object' && !Array.isArray(atlas.frames)) {
    return atlas.frames as Record<string, PackedFrame>
  }

  // Multiatlas: [{ textures: [{ image, frames: [{ filename, frame, ... }] }] }]
  const table: Record<string, PackedFrame> = {}
  const textures = (atlas.textures ?? (atlas as { textures?: unknown }).textures) as
    | Array<{ frames?: Array<PackedFrame & { filename: string }> }>
    | undefined

  for (const tex of textures ?? []) {
    for (const entry of tex.frames ?? []) {
      table[entry.filename] = entry
    }
  }

  return table
}

onMounted(async () => {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  try {
    const [atlas, image] = await Promise.all([
      fetch(props.atlasUrl).then((r) => r.json()),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = props.sheetUrl
      }),
    ])

    if (disposed) return

    const table = frameTable(atlas)
    const frames: PackedFrame[] = []
    for (let i = props.firstFrame; i <= props.lastFrame; i++) {
      const f = table[frameName(i)]
      if (f) frames.push(f)
    }
    if (frames.length === 0) return

    const source = frames[0]!.sourceSize
    canvas.width = source.w
    canvas.height = source.h
    const stepMs = 1000 / props.fps

    const tick = (t: number) => {
      if (t - lastStep >= stepMs) {
        lastStep = t
        const f = frames[frameIndex - props.firstFrame]!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(
          image,
          f.frame.x,
          f.frame.y,
          f.frame.w,
          f.frame.h,
          f.spriteSourceSize.x,
          f.spriteSourceSize.y,
          f.frame.w,
          f.frame.h,
        )
        frameIndex = frameIndex >= props.lastFrame ? props.firstFrame : frameIndex + 1
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  } catch {
    // A missing atlas/sheet leaves an empty canvas — the same placeholder
    // policy as Phaser surfaces: never throw from a figure render.
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <canvas
    ref="canvasEl"
    class="entity-sprite-canvas"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
  />
</template>

<style scoped>
.entity-sprite-canvas {
  display: block;
  width: auto;
  image-rendering: pixelated;
}
</style>

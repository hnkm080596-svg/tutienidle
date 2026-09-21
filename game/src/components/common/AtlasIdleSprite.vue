<script setup lang="ts">
// DOM mirror of the battle placeholder idle: steps a trimmed, packed
// texture atlas on a 2d canvas so queue/roster surfaces can show the same
// looping idle the Phaser scenes play — without booting a scene.
// Presentation only: reads public atlas JSON + PNG, owns no game state.
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface AtlasFrameRect {
  frame: { x: number; y: number; w: number; h: number }
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

interface LoadedAtlas {
  image: HTMLImageElement
  frames: AtlasFrameRect[]
  sourceWidth: number
  sourceHeight: number
}

const props = withDefaults(
  defineProps<{
    imageUrl: string
    atlasUrl: string
    framePrefix?: string
    frameSuffix?: string
    zeroPad?: number
    frameCount?: number
    frameRate?: number
  }>(),
  { framePrefix: 'frame_', frameSuffix: '.png', zeroPad: 3, frameCount: 32, frameRate: 8 },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loadFailed = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

// One fetch + one Image per atlas, shared by every card that mounts this
// component (module-level cache keyed by URL pair).
const atlasCache = new Map<string, Promise<LoadedAtlas>>()

function loadAtlas(imageUrl: string, atlasUrl: string): Promise<LoadedAtlas> {
  const key = `${imageUrl}|${atlasUrl}`
  let pending = atlasCache.get(key)

  if (!pending) {
    pending = (async () => {
      const response = await fetch(atlasUrl)
      const json = (await response.json()) as { frames: Record<string, AtlasFrameRect> }
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`atlas image failed: ${imageUrl}`))
        image.src = imageUrl
      })

      const frames: AtlasFrameRect[] = []
      for (let i = 0; i < props.frameCount; i += 1) {
        const name = `${props.framePrefix}${String(i).padStart(props.zeroPad, '0')}${props.frameSuffix}`
        const frame = json.frames[name]
        if (frame) frames.push(frame)
      }

      if (frames.length === 0) throw new Error(`no frames matched: ${atlasUrl}`)

      return {
        image,
        frames,
        sourceWidth: frames[0]!.sourceSize.w,
        sourceHeight: frames[0]!.sourceSize.h,
      }
    })()
    atlasCache.set(key, pending)
  }

  return pending
}

function drawFrame(atlas: LoadedAtlas, index: number) {
  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return

  const frame = atlas.frames[index % atlas.frames.length]!
  ctx.clearRect(0, 0, atlas.sourceWidth, atlas.sourceHeight)
  ctx.drawImage(
    atlas.image,
    frame.frame.x,
    frame.frame.y,
    frame.frame.w,
    frame.frame.h,
    frame.spriteSourceSize.x,
    frame.spriteSourceSize.y,
    frame.frame.w,
    frame.frame.h,
  )
}

onMounted(async () => {
  try {
    const atlas = await loadAtlas(props.imageUrl, props.atlasUrl)

    const canvas = canvasRef.value
    if (!canvas) return

    canvas.width = atlas.sourceWidth
    canvas.height = atlas.sourceHeight

    let index = 0
    drawFrame(atlas, index)

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) return

    timer = setInterval(() => {
      index = (index + 1) % atlas.frames.length
      drawFrame(atlas, index)
    }, 1000 / props.frameRate)
  } catch {
    loadFailed.value = true
  }
})

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})
</script>

<template>
  <canvas ref="canvasRef" class="atlas-idle-sprite" :class="{ 'atlas-idle-sprite--failed': loadFailed }" aria-hidden="true" />
</template>

<style scoped>
.atlas-idle-sprite {
  display: block;
  image-rendering: auto;
}

.atlas-idle-sprite--failed {
  display: none;
}
</style>

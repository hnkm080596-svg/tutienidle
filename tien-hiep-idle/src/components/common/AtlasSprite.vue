<script setup lang="ts">
// Phát animation từ atlas TexturePacker "multi-atlas" (idle.json/
// cultivate.json, xem MainScene.ts's preload() cho bản Phaser thật —
// component này là bản DOM/CSS tương đương cho panel Vue, vd
// CharacterPanel.vue, không có Phaser canvas riêng ở đó).
//
// Atlas bị "trimmed" (frame.x/frame.y đóng gói KHÔNG theo lưới đều —
// xác nhận qua asset-drop/idle.json, các frame nằm rải rác) nên KHÔNG
// dùng được kiểu CSS steps()/background-position đơn giản (chỉ đúng
// với spritesheet lưới đều). Thay vào đó: vẽ mỗi frame ở ĐÚNG toạ độ
// gốc (sourceSize x sourceSize, chưa scale) qua spriteSourceSize offset,
// rồi scale nguyên "sân khấu" đó xuống displayHeight mong muốn — giữ
// đúng vị trí tương đối giữa các frame, không bị "nhảy" khi đổi frame.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface AtlasFrame {
  filename: string
  frame: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
  spriteSourceSize: { x: number; y: number; w: number; h: number }
}

interface AtlasJson {
  textures: [{ image: string; size: { w: number; h: number }; frames: AtlasFrame[] }]
}

const props = withDefaults(defineProps<{
  atlasUrl: string
  imageUrl: string
  height: number
  fps?: number
  playing?: boolean
}>(), {
  fps: 8,
  playing: true,
})

const atlas = ref<AtlasJson | null>(null)
const frameIndex = ref(0)
let timer: number | undefined

async function loadAtlas(url: string) {
  const response = await fetch(url)

  atlas.value = await response.json()
  frameIndex.value = 0
}

const frames = computed(() => atlas.value?.textures[0]?.frames ?? [])
const atlasImageSize = computed(() => atlas.value?.textures[0]?.size ?? { w: 1, h: 1 })
// sourceSize CỐ ĐỊNH cho mọi frame trong 1 atlas (kích thước canvas gốc
// trước khi trim, xem TexturePacker docs) — đọc từ frame đầu là đủ.
const sourceSize = computed(() => frames.value[0]?.sourceSize ?? { w: 1, h: 1 })

const scale = computed(() => props.height / sourceSize.value.h)
const displayWidth = computed(() => sourceSize.value.w * scale.value)

const currentFrame = computed(() => frames.value[frameIndex.value] ?? null)

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function startTimer() {
  stopTimer()

  if (!props.playing || frames.value.length === 0) {
    return
  }

  timer = window.setInterval(() => {
    frameIndex.value = (frameIndex.value + 1) % frames.value.length
  }, 1000 / props.fps)
}

onMounted(async () => {
  await loadAtlas(props.atlasUrl)
  startTimer()
})

onBeforeUnmount(stopTimer)

// Đổi atlas (vd idle <-> cultivate) — tải lại + chạy lại animation từ
// frame 0, không giữ frameIndex cũ (2 sheet số frame có thể khác nhau).
watch(() => props.atlasUrl, async url => {
  await loadAtlas(url)
  startTimer()
})

watch(() => props.playing, startTimer)
</script>

<template>
  <div class="atlas-sprite" :style="{ width: `${displayWidth}px`, height: `${height}px` }">
    <div
      v-if="currentFrame"
      class="atlas-sprite__stage"
      :style="{ width: `${sourceSize.w}px`, height: `${sourceSize.h}px`, transform: `scale(${scale})` }"
    >
      <div
        class="atlas-sprite__frame"
        :style="{
          left: `${currentFrame.spriteSourceSize.x}px`,
          top: `${currentFrame.spriteSourceSize.y}px`,
          width: `${currentFrame.frame.w}px`,
          height: `${currentFrame.frame.h}px`,
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition: `-${currentFrame.frame.x}px -${currentFrame.frame.y}px`,
          backgroundSize: `${atlasImageSize.w}px ${atlasImageSize.h}px`,
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.atlas-sprite {
  position: relative;
  overflow: hidden;
  flex: 0 0 auto;
}

.atlas-sprite__stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.atlas-sprite__frame {
  position: absolute;
  background-repeat: no-repeat;
}
</style>

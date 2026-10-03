<script setup lang="ts">
// Preview wrapper for the ui-dong-fu standalone page: SceneDesignCanvas +
// vista + shared DongFuHomeContent, with locally owned wheel/board open
// state and the BAN DUYET stamp. Production mounts the same content
// through DongFuStage (store-driven wheel, real read-models).
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from './DongFuVista.vue'
import DongFuHomeContent from './DongFuHomeContent.vue'
import type { DongFuUiModel } from './dongFuUi'
defineProps<{ model: DongFuUiModel; notice: string; selected: string | null }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()
const wheelOpen = shallowRef(true)
const boardOpen = shallowRef(true)
const pointer = shallowRef({ x: 0, y: 0 })
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas>
    <main class="df-scene" :aria-label="t('dongFu.aria')" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }">
      <DongFuVista />
      <DongFuHomeContent
        :model="model"
        :notice="notice"
        :selected="selected"
        :wheel-open="wheelOpen"
        :board-open="boardOpen"
        @action="emit('action', $event)"
        @toggle-wheel="wheelOpen = !wheelOpen"
        @toggle-board="boardOpen = !boardOpen"
      />
      <footer class="df-preview-stamp"><strong>{{ t('preview') }}</strong><span>{{ t('sample') }}</span></footer>
    </main>
  </SceneDesignCanvas>
</template>
<style scoped>
.df-scene { --df-gold: #c9a761; --df-gold-light: #ebd094; --df-ivory: #f1e6c5; position: relative; width: 100%; height: 100%; overflow: hidden; background: #101b24; color: var(--df-ivory); font-family: var(--font-display, Georgia, serif); }
.df-scene :deep(*) { box-sizing: border-box; }
.df-scene :deep(button) { font-family: inherit; font-weight: 400; }
.df-scene :deep(button:focus-visible) { outline: 2px solid #fff1b8; outline-offset: 5px; }
.df-scene :deep(button:hover) { filter: brightness(1.16); }
.df-scene :deep(button:active) { filter: brightness(1.3); }
.df-preview-stamp { position: absolute; bottom: 19px; left: 21px; display: grid; gap: 3px; text-shadow: 0 1px 3px #000; color: #dacda9; }
.df-preview-stamp strong { font-size: 10px; letter-spacing: 2px; }.df-preview-stamp span { font-size: 10px; }
</style>

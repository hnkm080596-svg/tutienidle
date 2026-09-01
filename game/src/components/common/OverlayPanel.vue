<script setup lang="ts">
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import InkNineSlice from './primitives/InkNineSlice.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  height?: string
  layer?: number
}>(), {
  width: 'min(900px, 94vw)',
  height: 'auto',
  layer: OVERLAY_LAYERS.panel,
})

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open" class="overlay-panel" :style="{ zIndex: layer }" @click.self="emit('close')">
      <section class="overlay-panel__card" :style="{ width, height }" role="dialog" aria-modal="true" :aria-label="title">
        <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
        <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />
        <header class="overlay-panel__header">
          <div class="overlay-panel__heading">
            <slot name="heading">
              <h3>{{ title }}</h3>
              <slot name="subtitle" />
            </slot>
          </div>
          <slot name="header-actions" />
        </header>
        <div class="overlay-panel__body"><slot /></div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-panel { position: absolute; inset: 0; display: grid; place-items: center; padding: 3vh 3vw; background: var(--scrim-heavy); backdrop-filter: blur(6px); }
.overlay-panel__card { position: relative; isolation: isolate; max-width: 100%; max-height: 94vh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; container-type: inline-size; container-name: overlay-panel; color: var(--surface-text); font-family: var(--font-body); background: transparent; border: 0; border-radius: 0; box-shadow: none; }
.overlay-panel__header { position: relative; z-index: 3; flex: 0 0 auto; display: flex; align-items: center; gap: 12px; padding: clamp(32px, 4vw, 48px) clamp(30px, 4vw, 48px) 14px; border-bottom: 1px solid var(--surface-line); }
.overlay-panel__heading { min-width: 0; margin-right: auto; }
.overlay-panel__heading h3 { margin: 0; color: var(--surface-text); font: 700 var(--text-title) var(--font-display); letter-spacing: .06em; }
/* Fit-engine (2026-08-29) — body là ngân sách flex cho nội dung: con chiếm
   flex thay vì scroll. Con tự paginate khi vượt ngân sách (pattern BagGrid).
   overflow hidden là rào chặn cuối — panel con KHÔNG được dựa vào nó. */
.overlay-panel__body { position: relative; z-index: 3; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box; padding: 0 clamp(30px, 4vw, 48px) clamp(30px, 4vw, 48px); overflow: hidden; }
.overlay-fade-enter-active,.overlay-fade-leave-active { transition: opacity .2s ease; }
.overlay-fade-enter-active .overlay-panel__card,.overlay-fade-leave-active .overlay-panel__card { transition: transform .22s ease, opacity .22s ease; }
.overlay-fade-enter-from,.overlay-fade-leave-to { opacity: 0; }
.overlay-fade-enter-from .overlay-panel__card,.overlay-fade-leave-to .overlay-panel__card { transform: translateY(12px) scale(.985); opacity: 0; }
</style>

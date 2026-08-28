<script setup lang="ts">
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

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
        <header class="overlay-panel__header">
          <div class="overlay-panel__heading">
            <h3>{{ title }}</h3>
            <slot name="subtitle" />
          </div>
          <slot name="header-actions" />
          <button type="button" class="overlay-panel__close" aria-label="Đóng" @click="emit('close')">✕</button>
        </header>
        <div class="overlay-panel__body"><slot /></div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-panel { position: absolute; inset: 0; display: grid; place-items: center; padding: 3vh 3vw; background: var(--scrim); backdrop-filter: blur(4px); }
.overlay-panel__card { max-width: 100%; max-height: 94vh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; color: var(--text-primary); font-family: var(--font-body); background: linear-gradient(155deg, var(--ink-800), var(--ink-950)); border: 1px solid var(--chrome-500); border-radius: var(--radius-md); box-shadow: var(--shadow-panel); }
.overlay-panel__header { flex: 0 0 auto; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--ink-line); }
.overlay-panel__heading { min-width: 0; margin-right: auto; }
.overlay-panel__heading h3 { margin: 0; color: var(--chrome-100); font: 700 var(--text-title) var(--font-display); letter-spacing: .06em; }
.overlay-panel__close { width: var(--tap-min); height: var(--tap-min); padding: 0; color: var(--text-secondary); background: var(--ink-800); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); cursor: pointer; }
.overlay-panel__body { flex: 1 1 auto; min-height: 0; overflow: auto; }
.overlay-fade-enter-active,.overlay-fade-leave-active { transition: opacity .2s ease; }
.overlay-fade-enter-active .overlay-panel__card,.overlay-fade-leave-active .overlay-panel__card { transition: transform .22s ease, opacity .22s ease; }
.overlay-fade-enter-from,.overlay-fade-leave-to { opacity: 0; }
.overlay-fade-enter-from .overlay-panel__card,.overlay-fade-leave-to .overlay-panel__card { transform: translateY(12px) scale(.985); opacity: 0; }
</style>

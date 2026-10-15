<script setup lang="ts">
import { ref } from 'vue'
import SceneDesignCanvas from './SceneDesignCanvas.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '@/assets/rail-panel-layout.css'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title: string
    dialog?: boolean
    open?: boolean
    layer?: number
  }>(),
  {
    dialog: false,
    open: true,
    layer: undefined,
  },
)

const emit = defineEmits<{ close: [] }>()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
const dialogRoot = ref<HTMLElement | null>(null)
useDialogFocus(dialogRoot, () => Boolean(props.dialog && props.open), {
  onEscape: () => emit('close'),
})
</script>
<template>
  <SceneDesignCanvas v-if="dialog && open" overlay :style="{ zIndex: layer }">
    <section
      ref="dialogRoot"
      class="rail-panel-scene rail-panel-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      v-bind="$attrs"
      @click.self="emit('close')"
    >
      <div class="game-panel rail-panel-chrome" :style="{ backgroundImage: `url('${paper}')` }">
        <header class="game-panel__header">
          <div class="game-panel__heading"><h1 class="game-panel__title">{{ title }}</h1></div>
          <div class="game-panel__line" aria-hidden="true" />
        </header>
        <div class="game-panel__content">
          <div class="rail-panel-dialog__content"><slot /></div>
        </div>
      </div>
    </section>
  </SceneDesignCanvas>
  <div
    v-else-if="!dialog"
    class="game-panel rail-panel-chrome"
    v-bind="$attrs"
    :style="{ backgroundImage: `url('${paper}')` }"
  >
    <header class="game-panel__header">
      <div class="game-panel__heading"><h1 class="game-panel__title">{{ title }}</h1></div>
      <div class="game-panel__line" aria-hidden="true" />
    </header>
    <div class="game-panel__content"><slot /></div>
  </div>
</template>
<style scoped>
.rail-panel-dialog { position: absolute; inset: 0; }
.rail-panel-dialog__content { height: 100%; min-height: 0; overflow: auto; }
</style>

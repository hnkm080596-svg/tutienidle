<script setup lang="ts">
import { ref } from 'vue'
import SceneDesignCanvas from './SceneDesignCanvas.vue'
import GamePanel from './GamePanel.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ open: boolean; title: string; layer?: number }>()
const emit = defineEmits<{ close: [] }>()
const root = ref<HTMLElement | null>(null)
useDialogFocus(root, () => props.open, { onEscape: () => emit('close') })
</script>
<template>
  <SceneDesignCanvas v-if="open" overlay :style="{ zIndex: layer }">
    <section ref="root" class="rail-panel-scene rail-panel-dialog" role="dialog" aria-modal="true" :aria-label="title" v-bind="$attrs" @click.self="emit('close')">
      <GamePanel :title="title"><div class="rail-panel-dialog__content"><slot /></div></GamePanel>
    </section>
  </SceneDesignCanvas>
</template>
<style scoped>
.rail-panel-dialog { position: absolute; inset: 0; }
.rail-panel-dialog__content { height: 100%; min-height: 0; overflow: auto; }
</style>

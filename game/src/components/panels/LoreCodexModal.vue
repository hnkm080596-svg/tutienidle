<script setup lang="ts">
// Home Hub Phase 2 - ban modal PERSISTENT-CLICK cua Tooltip.vue (von
// chi hien khi hover, bien mat ngay khi roi chuot) - dung cho Tang
// Kinh Cac's Lore tab (Phase 7): nguoi choi bam vao 1 lore item, doc
// tron mo ta, tu dong khi bam ra ngoai/nut dong, KHONG tu an theo
// chuot nhu Tooltip. Style nhat quan NavMenuOverlay.vue.
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { useAudioStore } from '@/stores/audio'

defineProps<{
  content: { title: string; description: string } | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

// W7: close paths (backdrop + button) both read as cancel + modal close.
const audioStore = useAudioStore()
function onClose() {
  audioStore.cue('ui.cancel')
  audioStore.cue('ui.modal.close')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="lore-modal-fade">
      <div v-if="content" class="lore-modal" :style="{ zIndex: OVERLAY_LAYERS.modal }" @click.self="onClose">
        <div class="lore-modal__panel scrollfade">
          <h3 class="lore-modal__title">{{ content.title }}</h3>

          <p class="lore-modal__description">{{ content.description }}</p>

          <GameButton class="lore-modal__close" variant="secondary" size="sm" :sound="false" @click="onClose">{{ t('panels.common.close') }}</GameButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lore-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.lore-modal__panel {
  background: var(--ink-900);
  border: 1px solid var(--chrome-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  padding: 24px 28px;
  min-width: min(340px, 92vw);
  max-width: 480px;
  max-height: 84vh;
  overflow-y: auto;
}

.lore-modal__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  color: var(--chrome-100);
  text-align: center;
}

.lore-modal__description {
  margin: 0 0 20px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: 1.5;
  white-space: pre-line;
}

.lore-modal__close {
  display: block;
  margin: 0 auto;
  padding: 6px 24px;
}

.lore-modal__close:hover {
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}

.lore-modal-fade-enter-active,
.lore-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.lore-modal-fade-enter-from,
.lore-modal-fade-leave-to {
  opacity: 0;
}
</style>

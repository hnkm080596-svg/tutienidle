<script setup lang="ts">
import { computed, ref } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import GameButton from './GameButton.vue'
import InkNineSlice from './primitives/InkNineSlice.vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay
// window.confirm() native còn sót ở SettingsPanel.vue/QuanKhiPanel.vue.
// Modal, không đóng khi click nền (hành động cần xác nhận rõ ràng, khác
// OverlayPanel.vue vốn cho phép click-outside-đóng).
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}>(), {
  confirmLabel: 'Xác Nhận',
  cancelLabel: 'Hủy',
  danger: false,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const cardRef = ref<HTMLElement | null>(null)
useDialogFocus(cardRef, computed(() => props.open), { onEscape: () => emit('cancel') })
</script>

<template>
  <Transition name="confirm-modal-fade">
    <div v-if="open" class="confirm-modal" :style="{ zIndex: OVERLAY_LAYERS.panel }">
      <section ref="cardRef" class="confirm-modal__card" role="alertdialog" aria-modal="true" :aria-label="title">
        <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
        <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />
        <h3 class="confirm-modal__title">{{ title }}</h3>

        <p class="confirm-modal__message">{{ message }}</p>

        <div class="confirm-modal__actions">
          <GameButton class="confirm-modal__cancel" variant="ghost" @click="emit('cancel')">{{ cancelLabel }}</GameButton>
          <GameButton class="confirm-modal__confirm" :variant="danger ? 'danger' : 'primary'" @click="emit('confirm')">{{ confirmLabel }}</GameButton>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 3vh 3vw;
  background: var(--scrim);
  backdrop-filter: blur(4px);
}

.confirm-modal__card {
  position: relative;
  isolation: isolate;
  width: min(420px, 92vw);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  color: var(--paper-text, #211f1a);
  font-family: var(--font-body);
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.confirm-modal__card > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.confirm-modal__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--paper-text, #211f1a);
}

.confirm-modal__message {
  margin: 0;
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-body);
  line-height: var(--lh-body);
  white-space: pre-line;
}

.confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.confirm-modal-fade-enter-active,
.confirm-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-modal-fade-enter-active .confirm-modal__card,
.confirm-modal-fade-leave-active .confirm-modal__card {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.confirm-modal-fade-enter-from,
.confirm-modal-fade-leave-to {
  opacity: 0;
}

.confirm-modal-fade-enter-from .confirm-modal__card,
.confirm-modal-fade-leave-to .confirm-modal__card {
  transform: translateY(12px) scale(0.985);
  opacity: 0;
}
</style>

<script setup lang="ts">
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import GameButton from './GameButton.vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay
// window.confirm() native còn sót ở SettingsPanel.vue/QuanKhiPanel.vue.
// Modal, không đóng khi click nền (hành động cần xác nhận rõ ràng, khác
// OverlayPanel.vue vốn cho phép click-outside-đóng).
withDefaults(defineProps<{
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
</script>

<template>
  <Transition name="confirm-modal-fade">
    <div v-if="open" class="confirm-modal" :style="{ zIndex: OVERLAY_LAYERS.panel }">
      <section class="confirm-modal__card" role="alertdialog" aria-modal="true" :aria-label="title">
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
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 3vh 3vw;
  background: rgba(8, 9, 13, 0.76);
  backdrop-filter: blur(4px);
}

.confirm-modal__card {
  width: min(420px, 92vw);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  color: var(--text-primary);
  font-family: var(--font-body);
  background: linear-gradient(160deg, var(--ink-950), var(--ink-800));
  border-radius: var(--radius-md);
  box-shadow:
    var(--shadow-panel),
    0 0 0 1px var(--gold-700),
    inset 0 0 0 4px transparent,
    inset 0 0 0 5px var(--gold-300);
}

.confirm-modal__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--gold-500);
}

.confirm-modal__message {
  margin: 0;
  color: var(--text-secondary);
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

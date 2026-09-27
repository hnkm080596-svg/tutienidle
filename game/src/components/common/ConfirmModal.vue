<script setup lang="ts">
import { useId, watch } from 'vue'
import SysModalBase from './system/SysModalBase.vue'
import GameButton from './GameButton.vue'
import { AudioManager } from '@/core/audio/AudioManager'

// Shared chrome primitive (UI/UX rework Giai oan A) - thay
// window.confirm() native con sot o SettingsPanel.vue/QuanKhiPanel.vue.
// M-UI-SYSTEM: re-rendered on SysModalBase (system chrome + focus trap +
// Escape). Still no scrim-click close (confirm needs an explicit choice).
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  // Overlay-layer override for callers rendering over a high surface
  // (e.g. the save gate at 4000) - defaults to OVERLAY_LAYERS.panel.
  layer?: number
}>(), {
  confirmLabel: 'Xác Nhận',
  cancelLabel: 'Hủy',
  danger: false,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

// W7: shared confirm chrome owns modal open + confirm/cancel cues for
// every ConfirmModal consumer (QuanKhiPanel path choice, save gate, ...).
const audio = AudioManager.getInstance()

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) audio.playCue('ui.modal.open')
  },
)

function onConfirm() {
  audio.playCue('ui.confirm')
  audio.playCue('ui.modal.close')
  emit('confirm')
}

function onCancel() {
  audio.playCue('ui.cancel')
  audio.playCue('ui.modal.close')
  emit('cancel')
}

// Remediation Task 6 (2026-09-05) - screen reader can dialog uoc tham
// chieu toi title/description that (aria-labelledby/describedby), khong
// chi aria-label. useId() am bao ID per-instance - nhieu modal ong
// thoi khong trung ID tinh.
// M-UI-SYSTEM: title id lives inside SysModalBase; the message id is
// passed down as describedBy.
const messageId = useId()
</script>

<template>
  <SysModalBase
    :open="props.open"
    :title="props.title"
    width="min(420px, 92vw)"
    role="alertdialog"
    :described-by="messageId"
    :close-on-scrim="false"
    :layer="props.layer"
    @close="onCancel"
  >
    <p :id="messageId" class="confirm-modal__message">{{ message }}</p>

    <div class="confirm-modal__actions">
      <GameButton class="confirm-modal__cancel" variant="ghost" :sound="false" @click="onCancel">{{ cancelLabel }}</GameButton>
      <GameButton class="confirm-modal__confirm" :variant="danger ? 'danger' : 'primary'" :sound="false" @click="onConfirm">{{ confirmLabel }}</GameButton>
    </div>
  </SysModalBase>
</template>

<style scoped>
.confirm-modal__message {
  margin: 0;
  color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50));
  font-size: var(--text-body);
  line-height: var(--lh-body);
  white-space: pre-line;
}

.confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>

<script setup lang="ts">
import { useId } from 'vue'
import SysModalBase from './system/SysModalBase.vue'
import GameButton from './GameButton.vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay
// window.confirm() native còn sót ở SettingsPanel.vue/QuanKhiPanel.vue.
// M-UI-SYSTEM: re-rendered on SysModalBase (system chrome + focus trap +
// Escape). Still no scrim-click close (confirm needs an explicit choice).
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

// Remediation Task 6 (2026-09-05) — screen reader cần dialog được tham
// chiếu tới title/description thật (aria-labelledby/describedby), không
// chỉ aria-label. useId() đảm bảo ID per-instance — nhiều modal đồng
// thời không trùng ID tĩnh.
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
    @close="emit('cancel')"
  >
    <p :id="messageId" class="confirm-modal__message">{{ message }}</p>

    <div class="confirm-modal__actions">
      <GameButton class="confirm-modal__cancel" variant="system" @click="emit('cancel')">{{ cancelLabel }}</GameButton>
      <GameButton class="confirm-modal__confirm" variant="system" :accent-var="danger ? 'var(--sys-danger)' : undefined" @click="emit('confirm')">{{ confirmLabel }}</GameButton>
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

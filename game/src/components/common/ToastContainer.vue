<script setup lang="ts">
import { useNotificationStore } from '@/stores/notification'
import type { NotificationKind } from '@/core/notification/NotificationEvent'

const notification = useNotificationStore()

// Khớp token màu có sẵn trong assets/theme.css — không thêm token
// mới, tái dùng đúng bảng màu game đã có.
const KIND_COLOR: Record<NotificationKind, string> = {
  loot: 'var(--jade)',
  craft: 'var(--gold-500)',
  upgrade: 'var(--gold-500)',
  save: 'var(--azure)',
  warning: 'var(--gold-500)',
  error: 'var(--crimson)',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in notification.toasts"
          :key="toast.id"
          class="toast-item"
          :style="{ '--toast-color': KIND_COLOR[toast.kind] }"
          @click="notification.dismiss(toast.id)"
        >
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  min-width: 200px;
  max-width: 320px;
  padding: 10px 14px;
  background: rgba(15, 15, 20, 0.96);
  border: 1px solid var(--toast-color, var(--ink-line));
  border-left: 3px solid var(--toast-color, var(--ink-line));
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.78rem;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

.toast-leave-active {
  position: absolute;
}
</style>

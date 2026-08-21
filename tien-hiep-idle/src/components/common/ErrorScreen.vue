<script setup lang="ts">
import { useErrorStore } from '@/stores/error'

const errorStore = useErrorStore()

// "Thử Lại" chỉ đóng overlay tại chỗ (thử render lại, không mất tiến
// trình phiên hiện tại) — "Về Trang Chủ" reload thật (reset an toàn,
// chấp nhận mất vài giây chưa lưu, game đã có nút Lưu Tiến Trình thủ
// công + toast xác nhận, xem stores/notification.ts).
function retry() {
  errorStore.clear()
}

function returnHome() {
  window.location.reload()
}
</script>

<template>
  <div v-if="errorStore.current" class="error-screen">
    <div class="error-screen__panel">
      <h2 class="error-screen__title">Đã xảy ra lỗi</h2>

      <p class="error-screen__message">{{ errorStore.current }}</p>

      <div class="error-screen__actions">
        <button type="button" @click="retry">Thử Lại</button>

        <button type="button" @click="returnHome">Về Trang Chủ</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-screen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 8, 0.92);
}

.error-screen__panel {
  max-width: 420px;
  padding: 28px 32px;
  background: var(--ink-900);
  border: 1px solid var(--crimson);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.error-screen__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  color: var(--crimson);
  font-size: 1.15rem;
}

.error-screen__message {
  margin: 0 0 20px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  word-break: break-word;
}

.error-screen__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.error-screen__actions button {
  padding: 8px 18px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
}

.error-screen__actions button:hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}
</style>

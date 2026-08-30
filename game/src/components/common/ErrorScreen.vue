<script setup lang="ts">
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
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
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

      <div class="error-screen__scroll">
        <h2 class="error-screen__title">Đã xảy ra lỗi</h2>

        <p class="error-screen__message">{{ errorStore.current }}</p>

        <div class="error-screen__actions">
          <GameButton variant="primary" @click="retry">Thử Lại</GameButton>

          <GameButton variant="secondary" @click="returnHome">Về Trang Chủ</GameButton>
        </div>
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
  background: var(--scrim-heavy);
}

.error-screen__panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  max-width: 420px;
  max-height: 90vh;
  padding: 28px 32px;
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.error-screen__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.error-screen__scroll {
  min-height: 0;
  overflow: auto;
}

.error-screen__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  color: var(--crimson);
  font-size: var(--text-title);
  font-weight: 700;
}

.error-screen__message {
  margin: 0 0 20px;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  word-break: break-word;
}

.error-screen__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>

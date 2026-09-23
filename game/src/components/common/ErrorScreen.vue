<script setup lang="ts">
import GameButton from '@/components/common/GameButton.vue'
import SysPanel from '@/components/common/system/SysPanel.vue'
import { useErrorStore } from '@/stores/error'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

const errorStore = useErrorStore()

// UI-014 (Task 9, 2026-09-07) — nút trước đây nhãn "Thử Lại" nhưng thực
// chất CHỈ clear error store (không retry/re-mount operation nào). Đổi
// nhãn thành "Đóng" khớp behavior thật (plan Task 9: "rename it if it
// only clears the store"); "Tải Lại Trang" reload thật là path recovery
// chính (reset an toàn, autosave đã có pagehide guard).
function dismiss() {
  errorStore.clear()
}

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div v-if="errorStore.current" class="error-screen" :style="{ zIndex: OVERLAY_LAYERS.appError }">
    <!-- M-UI-OVERHAUL: system console, danger domain accent. -->
    <SysPanel variant="primary" :rim-active="true" class="error-screen__panel sys-domain--danger">
      <div class="error-screen__scroll">
        <h2 class="error-screen__title">Đã xảy ra lỗi</h2>

        <p class="error-screen__message">{{ errorStore.current }}</p>

        <div class="error-screen__actions">
          <GameButton variant="system" @click="dismiss">Đóng</GameButton>

          <GameButton variant="system" accent-var="var(--sys-text-dim)" @click="reloadPage">Tải Lại Trang</GameButton>
        </div>
      </div>
    </SysPanel>
  </div>
</template>

<style scoped>
.error-screen {
  position: fixed;
  inset: 0;
  /* z-index via OVERLAY_LAYERS.appError (inline style) — high, but the
     route-transition curtain still sits above it by contract. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sys-veil, var(--scrim-heavy));
}

.error-screen__panel {
  display: flex;
  flex-direction: column;
  max-width: 420px;
  max-height: 90vh;
  padding: 28px 32px;
  text-align: center;
  font-family: var(--sys-font-body, var(--font-body));
}

.error-screen__scroll {
  min-height: 0;
  overflow: auto;
}

.error-screen__title {
  margin: 0 0 12px;
  font-family: var(--sys-font-display, var(--font-display));
  color: var(--sys-accent, var(--crimson));
  font-size: var(--text-title);
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.error-screen__message {
  margin: 0 0 20px;
  color: var(--sys-text-muted, var(--paper-text-soft));
  font-size: var(--text-sm);
  word-break: break-word;
}

.error-screen__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>

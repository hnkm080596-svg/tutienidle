<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { useErrorStore } from '@/stores/error'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'

const errorStore = useErrorStore()
const { t } = useI18n()

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
    <div class="error-screen__panel paper-on-dark">
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

      <div class="error-screen__scroll">
        <h2 class="error-screen__title">{{ t('errors.app.title') }}</h2>

        <p class="error-screen__message">{{ errorStore.current }}</p>

        <div class="error-screen__actions">
          <GameButton variant="primary" @click="dismiss">{{ t('errors.app.close') }}</GameButton>

          <GameButton variant="secondary" @click="reloadPage">{{ t('errors.app.reload') }}</GameButton>
        </div>

        <!-- BETA-FINAL PR1 / spec B2 - build identity on the error surface
             so a screenshot of a crash carries the release manifest values. -->
        <p class="error-screen__build" data-testid="error-build">
          {{
            t('errors.app.build', {
              product: BUILD_IDENTITY.productName,
              version: BUILD_IDENTITY.appVersion,
              build: BUILD_IDENTITY.buildId,
              sha: shortGitSha(),
              env: BUILD_IDENTITY.backendEnvironment,
            })
          }}
        </p>
      </div>
    </div>
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

.error-screen__build {
  margin: 16px 0 0;
  color: var(--paper-text-soft);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  word-break: break-all;
}
</style>

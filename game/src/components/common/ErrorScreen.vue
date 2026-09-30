<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { useErrorStore } from '@/stores/error'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'
import {
  getDiagnosticRecorder,
  recordDiagnostic,
} from '@/services/diagnostics/DiagnosticRecorder'
import { useActiveUpdates } from '@/composables/useUpdates'

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

// BETA-FINAL PR11 / spec B8 - the error surface carries the stable report
// id (main-process minted on Electron, recorder fallback on web) so a
// screenshot or a copied line correlates to the local crash bundle. Export
// goes through the main-side save dialog only - the renderer never sees a
// filesystem path it could influence.
const reportId = ref('')
const reportCopied = ref(false)
const exportState = ref<'idle' | 'exported' | 'failed'>('idle')
const canExport = typeof window.electronAPI?.exportDiagnostics === 'function'

// BETA-FINAL PR12 - support-visible update status on the error surface:
// a crash screenshot also carries whether a verified update was pending,
// plus a manual re-check escape when the feed is reachable.
const updates = useActiveUpdates()
const updateState = computed(() => updates?.state.value ?? null)
const updateLabel = computed(() => {
  const state = updateState.value
  if (state === null) return null
  switch (state.phase) {
    case 'available':
    case 'downloading':
    case 'downloaded':
    case 'installing':
      return `${state.phase}:${state.candidate?.version ?? ''}`
    case 'error':
      return `error:${state.error?.code ?? 'UNKNOWN'}`
    case 'unavailable':
      return 'up-to-date'
    default:
      return state.phase
  }
})

onMounted(() => {
  reportId.value = getDiagnosticRecorder()?.reportId ?? ''
  if (window.electronAPI?.getDiagnosticReportId) {
    void window.electronAPI
      .getDiagnosticReportId()
      .then((id) => {
        reportId.value = id
      })
      .catch(() => undefined)
  }
})

function copyReportInfo() {
  const text = [
    `report=${reportId.value}`,
    `product=${BUILD_IDENTITY.productName}`,
    `version=${BUILD_IDENTITY.appVersion}`,
    `build=${BUILD_IDENTITY.buildId}`,
    `sha=${shortGitSha()}`,
    `env=${BUILD_IDENTITY.backendEnvironment}`,
  ].join(' ')
  try {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        reportCopied.value = true
      })
      .catch(() => undefined)
  } catch {
    // Clipboard unavailable - the report id stays visible for manual copy.
  }
}

async function exportDiagnostics() {
  const api = window.electronAPI
  if (!api?.exportDiagnostics) return
  try {
    const context = (await getDiagnosticRecorder()?.collectExportContext()) ?? {}
    const result = await api.exportDiagnostics(context)
    // A cancelled save dialog is not a failure - only surface real errors.
    if (result.status === 'exported') {
      exportState.value = 'exported'
    } else if (result.status !== 'cancelled') {
      exportState.value = 'failed'
    }
    recordDiagnostic({
      source: 'renderer',
      severity: result.status === 'exported' ? 'info' : 'warning',
      category: 'export',
      code: `EXPORT_${result.status.toUpperCase()}`,
      message: `diagnostic export ${result.status}`,
      details: { status: result.status },
    })
  } catch {
    exportState.value = 'failed'
  }
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

        <div v-if="reportId !== '' || canExport" class="error-screen__report">
          <p v-if="reportId !== ''" class="error-screen__report-id" data-testid="error-report-id">
            {{ t('errors.app.reportId', { id: reportId }) }}
          </p>
          <div class="error-screen__report-actions">
            <GameButton variant="secondary" @click="copyReportInfo">
              {{ reportCopied ? t('errors.app.copied') : t('errors.app.copyReport') }}
            </GameButton>
            <GameButton v-if="canExport" variant="secondary" @click="exportDiagnostics">
              {{ t('errors.app.exportDiagnostics') }}
            </GameButton>
          </div>
          <p v-if="exportState !== 'idle'" class="error-screen__export-state" data-testid="error-export-state">
            {{ exportState === 'exported' ? t('errors.app.exportDone') : t('errors.app.exportFailed') }}
          </p>
        </div>

        <p v-if="updateLabel !== null" class="error-screen__build" data-testid="error-update-status">
          {{ t('errors.app.updateStatus', { status: updateLabel }) }}
        </p>

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

.error-screen__report {
  margin: 16px 0 0;
}

.error-screen__report-id {
  margin: 0 0 8px;
  color: var(--paper-text-soft);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  word-break: break-all;
}

.error-screen__report-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.error-screen__export-state {
  margin: 8px 0 0;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.error-screen__build {
  margin: 16px 0 0;
  color: var(--paper-text-soft);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  word-break: break-all;
}
</style>

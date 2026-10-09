<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
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
const titleId = useId()

// UI-014 (Task 9, 2026-09-07) - nut truoc day nhan "Thu Lai" nhung thuc
// chat CHI clear error store (khong retry/re-mount operation nao). Doi
// nhan thanh "Dong" khop behavior that (plan Task 9: "rename it if it
// only clears the store"); "Tai Lai Trang" reload that la path recovery
// chinh (reset an toan, autosave da co pagehide guard).
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

// BETA-FINAL PR13 / spec B7 - a crash is exactly the moment a feedback
// report is most valuable. The dialog mounts above this surface (appError
// layer + 1) prefilled with the error message; submit still goes through
// the same intake path (and degrades to export-only when auth is dead).
const feedbackOpen = ref(false)

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
    <OrnateDialog
      class="error-screen__panel"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('errors.app.title')"
      :title-id="titleId"
      badge="alert"
      width="min(620px, 94vw)"
    >
      <p class="error-screen__message">{{ errorStore.current }}</p>

      <div class="error-screen__report">
        <p v-if="reportId !== ''" class="error-screen__report-id" data-testid="error-report-id">
          {{ t('errors.app.reportId', { id: reportId }) }}
        </p>
        <div class="error-screen__report-actions">
          <OrnateButton class="error-screen__report-btn" variant="dark" @click="copyReportInfo">
            {{ reportCopied ? t('errors.app.copied') : t('errors.app.copyReport') }}
          </OrnateButton>
          <OrnateButton v-if="canExport" class="error-screen__report-btn" variant="dark" @click="exportDiagnostics">
            {{ t('errors.app.exportDiagnostics') }}
          </OrnateButton>
          <!-- Feedback is always offered: the intake degrades to
               export-only when the session is dead (BETA-FINAL PR13). -->
          <OrnateButton class="error-screen__report-btn" variant="dark" data-testid="error-feedback" @click="feedbackOpen = true">
            {{ t('errors.app.feedback') }}
          </OrnateButton>
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

      <template #actions>
        <OrnateButton variant="gold" @click="dismiss">{{ t('errors.app.close') }}</OrnateButton>
        <OrnateButton variant="dark" @click="reloadPage">{{ t('errors.app.reload') }}</OrnateButton>
      </template>
    </OrnateDialog>
  </div>

  <!-- BETA-FINAL PR13 / spec B7 - opens ABOVE this surface so the error
       stays behind the dialog; the error text prefills the report. -->
  <FeedbackDialog
    :open="feedbackOpen"
    :layer="OVERLAY_LAYERS.appError + 1"
    :initial-description="errorStore.current ?? ''"
    @close="feedbackOpen = false"
  />
</template>

<style scoped>
.error-screen {
  position: fixed;
  inset: 0;
  /* z-index via OVERLAY_LAYERS.appError (inline style) - high, but the
     route-transition curtain still sits above it by contract. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim-heavy);
}

/* Ornate dialog chrome (see ConfirmModal): whole-component frame/band/
   badge art at a fixed aspect; the body region scrolls inside. */
.error-screen__panel {
  flex: none;
}

.error-screen__message {
  flex: none;
  margin: 0;
  max-width: 100%;
  color: var(--paper-text-soft, #5e5a50);
  font-size: min(2.8cqh, var(--text-sm));
  line-height: 1.5;
  text-align: center;
  word-break: break-word;
}

.error-screen__report {
  flex: none;
  margin: 1.6cqh 0 0;
  width: 100%;
}

.error-screen__report-id {
  margin: 0 0 0.8cqh;
  color: var(--paper-text-soft, #5e5a50);
  font-family: var(--font-mono, monospace);
  font-size: min(2.2cqh, var(--text-xs));
  text-align: center;
  word-break: break-all;
}

.error-screen__report-actions {
  display: flex;
  gap: 2cqw;
  justify-content: center;
  height: 11cqh;
  --ornate-button-label-size: min(2.6cqh, 1.7cqw);
  --ornate-button-wrap: normal;
}

.error-screen__export-state {
  margin: 0.8cqh 0 0;
  color: var(--paper-text-soft, #5e5a50);
  font-size: min(2.2cqh, var(--text-xs));
  text-align: center;
}

.error-screen__build {
  flex: none;
  margin: 1.4cqh 0 0;
  max-width: 100%;
  color: var(--paper-text-soft, #5e5a50);
  font-family: var(--font-mono, monospace);
  font-size: min(2.2cqh, var(--text-xs));
  text-align: center;
  word-break: break-all;
}
</style>

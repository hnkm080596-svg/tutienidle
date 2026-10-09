<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'
import { dialogArt } from '@/components/common/art/dialogArt'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import { useSaveIssueStore } from '@/stores/saveIssue'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, deleteSave, importSaveRaw } from '@/services/save/SaveSystem'
import { validateRecoveryData } from '@/services/save/recoveryApi'
import { cloudSaveCoordinator } from '@/services/cloudSave/CloudSaveServiceFactory'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import ConfirmModal from './ConfirmModal.vue'
import { markResetNotice } from '@/composables/resumeSession'

const saveIssue = useSaveIssueStore()
const notification = useNotificationStore()
const { t } = useI18n()
const titleId = useId()
const importButtonUrl = dialogArt('button-dark-v1')

// B1.9a - under the remote authority the corrupt/incompatible bytes
// live server-side. Export still preserves raw data for manual
// recovery; import is validate+export only (it cannot overwrite the
// cloud row); reset permanently deletes the server character + saves
// (reset_character) so the next boot restarts at creation.
const remoteAuthoritative = cloudSaveCoordinator.capability === 'remote-authoritative'

// The remote reset is only legal when the offending bytes actually live
// server-side. pending-conflict/pending-quarantined report the same
// surface but scope 'local' - the remote row is the healthy head there,
// so the reset must stay a local-envelope clear. Computed so a re-report
// while mounted can't leave the destructive gate on a stale scope.
const remoteResettable = computed(() => remoteAuthoritative && saveIssue.scope === 'remote')

// Thay window.confirm()/window.alert() native - modal xac nhan dong bo
// hoa bang pending-action giong SettingsPanel.vue: mo ConfirmModal, hanh
// dong that chi chay khi resolvePendingConfirm() (nut "Xac Nhan") duoc goi.
const pendingConfirm = ref<null | { title: string; message: string; danger: boolean; onConfirm: () => void }>(null)

function requestConfirm(title: string, message: string, onConfirm: () => void, danger = false) {
  pendingConfirm.value = { title, message, danger, onConfirm }
}

function resolvePendingConfirm() {
  pendingConfirm.value?.onConfirm()
  pendingConfirm.value = null
}

function cancelPendingConfirm() {
  pendingConfirm.value = null
}

function handleExport() {
  exportSaveToFile(
    saveIssue.raw,
    remoteAuthoritative
      ? { source: 'cloud', revision: cloudSaveCoordinator.getRevision() }
      : { source: 'local', revision: cloudSaveCoordinator.getRevision() },
  )
}

function handleReset() {
  requestConfirm(
    remoteResettable.value
      ? t('saveIncompatible.confirm.resetCloudTitle')
      : t('saveIncompatible.confirm.resetTitle'),
    remoteResettable.value
      ? t('saveIncompatible.confirm.resetCloudBody')
      : t('saveIncompatible.confirm.resetBody'),
    () => {
      // Mission A review - deleteSave() returns false on storage
      // failure; reloading would boot back into the same corrupt save.
      // For a remote-scope issue the authoritative row is the corrupt
      // one, so reset_character deletes it first; only then does the
      // local cache reset make the reload land on character creation
      // instead of re-loading the corrupt row.
      void (async () => {
        if (remoteResettable.value) {
          const reset = await cloudSaveCoordinator.resetCharacter()
          if (reset.status === 'unavailable') {
            notification.push('error', reset.message || t('saveIncompatible.notify.deleteFailed'))
            return
          }
        }
        if (deleteSave()) {
          markResetNotice()
          window.location.reload()
        } else {
          notification.push('error', t('saveIncompatible.notify.deleteFailed'))
        }
      })()
    },
    true,
  )
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    const rawText = String(reader.result)

    if (remoteAuthoritative) {
      // Remote mode: classify the file, export the validated copy back
      // for manual recovery, never overwrite the cloud row or cache.
      const validation = validateRecoveryData(rawText)

      if (validation.status === 'valid') {
        exportSaveToFile(validation.normalizedRaw, { source: 'recovery-import' })
        notification.push('save', t('saveIncompatible.notify.importValidatedRemote'))
      } else {
        requestConfirm(t('saveIncompatible.confirm.importFailedTitle'), t('saveIncompatible.confirm.importFailedBody'), () => {}, false)
      }

      input.value = ''
      return
    }

    const ok = importSaveRaw(rawText)

    if (ok) {
      window.location.reload()
    } else {
      // UI-007/UI-014 (Task 5) - confirm rong-callback -> alert close-only
      // (khong co action "xac nhan" vo nghia); reset file input de retry.
      requestConfirm(t('saveIncompatible.confirm.importFailedTitle'), t('saveIncompatible.confirm.importFailedBody'), () => {}, false)

      input.value = ''
    }
  }

  reader.readAsText(file)
}
</script>

<template>
  <div class="save-incompatible" :style="{ zIndex: OVERLAY_LAYERS.saveGate }">
    <InkWashBackdrop left-mountain right-mountain bottom-mist />
    <OrnateDialog
      class="save-incompatible__panel"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('saveIncompatible.title')"
      :title-id="titleId"
      badge="alert"
      width="min(600px, 94vw)"
    >
      <p v-if="saveIssue.status === 'incompatible'" class="save-incompatible__message">
        {{ t('saveIncompatible.bodyIncompatible', { version: saveIssue.foundVersion ?? '?' }) }}
      </p>

      <p v-else class="save-incompatible__message">
        {{ t('saveIncompatible.bodyCorrupted') }}
      </p>

      <div class="save-incompatible__actions">
        <!-- No raw bytes means nothing to export (e.g. a rejected first
             write where no save ever persisted) - hide rather than
             download a 0-byte file labelled as the save. -->
        <OrnateButton v-if="saveIssue.raw" variant="dark" @click="handleExport">{{ t('saveIncompatible.actions.export') }}</OrnateButton>

        <label class="save-incompatible__import">
          <img class="save-incompatible__import-art" :src="importButtonUrl" alt="" aria-hidden="true" draggable="false" />
          <span class="save-incompatible__import-label">{{ t('saveIncompatible.actions.import') }}</span>
          <input type="file" accept="application/json" @change="handleImport" />
        </label>

        <OrnateButton variant="gold" @click="handleReset">
          {{ remoteResettable ? t('saveIncompatible.actions.resetCloud') : t('saveIncompatible.actions.reset') }}
        </OrnateButton>
      </div>
    </OrnateDialog>

    <ConfirmModal
      :open="pendingConfirm !== null"
      :title="pendingConfirm?.title ?? ''"
      :message="pendingConfirm?.message ?? ''"
      :danger="pendingConfirm?.danger ?? false"
      :layer="OVERLAY_LAYERS.saveGateModal"
      @confirm="resolvePendingConfirm"
      @cancel="cancelPendingConfirm"
    />
  </div>
</template>

<style scoped>
.save-incompatible {
  position: fixed;
  inset: 0;
  /* z-index via OVERLAY_LAYERS.saveGate (inline style) - top of the
     content layers, still under the curtain by contract. */
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ink-950);
}

.save-incompatible__panel {
  /* margin:auto - van can giua khi vua man hinh, nhung khi overflow
     thi panel dat len tren de cuon toi duoc toan bo noi dung. */
  flex: none;
  margin: auto;
}

.save-incompatible__message {
  flex: none;
  margin: 0;
  max-width: 100%;
  color: var(--paper-text-soft, #5e5a50);
  font-size: min(2.9cqh, var(--text-sm));
  line-height: 1.5;
  text-align: center;
}

.save-incompatible__actions {
  --ornate-button-h: 9.5cqh;
  flex: none;
  margin-top: 2cqh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6cqh;
}

/* The import affordance paints no button of its own - the dark ornate
   button art supplies the shell and the hidden file input still owns
   the click target. */
.save-incompatible__import {
  position: relative;
  display: inline-grid;
  place-items: center;
  height: var(--ornate-button-h);
  aspect-ratio: 219 / 120;
  cursor: pointer;
  color: #f3e7c8;
  font-family: var(--font-display);
  font-size: min(4.6cqh, 3cqw, 32px);
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: transform var(--hk-motion-micro) var(--hk-ease-standard);
}

.save-incompatible__import-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.save-incompatible__import-label {
  position: relative;
  max-width: 78%;
  transform: translateY(-12%);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.save-incompatible__import input {
  position: absolute;
  inset: 0;
  z-index: 4;
  opacity: 0;
  cursor: pointer;
}

.save-incompatible__import:hover {
  transform: scale(1.045);
}
</style>

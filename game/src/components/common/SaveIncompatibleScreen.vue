<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import { useSaveIssueStore } from '@/stores/saveIssue'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, deleteSave, importSaveRaw } from '@/services/save/SaveSystem'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import ConfirmModal from './ConfirmModal.vue'
import { markResetNotice } from '@/composables/resumeSession'

const saveIssue = useSaveIssueStore()
const notification = useNotificationStore()
const { t } = useI18n()

// Thay window.confirm()/window.alert() native — modal xác nhận đồng bộ
// hoá bằng pending-action giống SettingsPanel.vue: mở ConfirmModal, hành
// động thật chỉ chạy khi resolvePendingConfirm() (nút "Xác Nhận") được gọi.
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
  exportSaveToFile(saveIssue.raw)
}

function handleReset() {
  requestConfirm(
    t('saveIncompatible.confirm.resetTitle'),
    t('saveIncompatible.confirm.resetBody'),
    () => {
      // Mission A review — deleteSave() returns false on storage
      // failure; reloading would boot back into the same corrupt save.
      if (deleteSave()) {
        markResetNotice()
        window.location.reload()
      } else {
        notification.push('error', t('saveIncompatible.notify.deleteFailed'))
      }
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
    const ok = importSaveRaw(String(reader.result))

    if (ok) {
      window.location.reload()
    } else {
      // UI-007/UI-014 (Task 5) — confirm rỗng-callback → alert close-only
      // (không có action "xác nhận" vô nghĩa); reset file input để retry.
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
    <div class="save-incompatible__panel paper-on-dark">
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

      <h2 class="save-incompatible__title">{{ t('saveIncompatible.title') }}</h2>

      <p v-if="saveIssue.status === 'incompatible'" class="save-incompatible__message">
        {{ t('saveIncompatible.bodyIncompatible', { version: saveIssue.foundVersion ?? '?' }) }}
      </p>

      <p v-else class="save-incompatible__message">
        {{ t('saveIncompatible.bodyCorrupted') }}
      </p>

      <div class="save-incompatible__actions">
        <GameButton variant="secondary" @click="handleExport">{{ t('saveIncompatible.actions.export') }}</GameButton>

        <label class="save-incompatible__import">
          {{ t('saveIncompatible.actions.import') }}
          <input type="file" accept="application/json" @change="handleImport" />
        </label>

        <GameButton variant="danger" @click="handleReset">{{ t('saveIncompatible.actions.reset') }}</GameButton>
      </div>
    </div>

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
  /* z-index via OVERLAY_LAYERS.saveGate (inline style) — top of the
     content layers, still under the curtain by contract. */
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ink-950);
}

.save-incompatible__panel {
  /* margin:auto — vẫn căn giữa khi vừa màn hình, nhưng khi overflow
     thì panel dạt lên trên để cuộn tới được toàn bộ nội dung. */
  position: relative;
  isolation: isolate;
  margin: auto;
  max-width: 460px;
  padding: 28px 32px;
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.save-incompatible__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.save-incompatible__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-title);
  font-weight: 700;
}

.save-incompatible__message {
  margin: 0 0 20px;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.save-incompatible__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.save-incompatible__import {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap-comfortable);
  padding: var(--space-2) var(--space-4);
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 700;
}

.save-incompatible__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.save-incompatible__import:hover {
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}
</style>

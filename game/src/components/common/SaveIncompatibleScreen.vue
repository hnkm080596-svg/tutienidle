<script setup lang="ts">
import { ref } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import SysPanel from '@/components/common/system/SysPanel.vue'
import { useSaveIssueStore } from '@/stores/saveIssue'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, deleteSave, importSaveRaw } from '@/services/save/SaveSystem'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import ConfirmModal from './ConfirmModal.vue'

const saveIssue = useSaveIssueStore()
const notification = useNotificationStore()

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
    'Xoá & Bắt Đầu Mới',
    'Xoá save hiện tại và bắt đầu nhân vật mới? Nhớ Tải Về Save trước nếu chưa làm — hành động này không thể hoàn tác.',
    () => {
      // Mission A review — deleteSave() returns false on storage
      // failure; reloading would boot back into the same corrupt save.
      if (deleteSave()) {
        window.location.reload()
      } else {
        notification.push('error', 'Không xoá được save — trình duyệt đang từ chối truy cập bộ nhớ.')
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
      requestConfirm('Nhập Save Thất Bại', 'File save không hợp lệ.', () => {}, false)

      input.value = ''
    }
  }

  reader.readAsText(file)
}
</script>

<template>
  <div class="save-incompatible" :style="{ zIndex: OVERLAY_LAYERS.saveGate }">
    <!-- M-UI-OVERHAUL: full-screen gate -> T2 system console, danger domain
         accent (the save itself is the blocked resource). -->
    <SysPanel variant="primary" :rim-active="true" class="save-incompatible__panel sys-domain--danger">
      <h2 class="save-incompatible__title">Save không tương thích với phiên bản hiện tại</h2>

      <p v-if="saveIssue.status === 'incompatible'" class="save-incompatible__message">
        Save của bạn thuộc phiên bản
        <strong>{{ saveIssue.foundVersion ?? '?' }}</strong>, không tương thích với phiên bản
        hiện tại. Tiến trình vẫn còn nguyên — tải về trước khi tiếp tục.
      </p>

      <p v-else class="save-incompatible__message">
        Không đọc được save hiện tại (dữ liệu có thể đã hỏng). Bạn có thể tải file thô về để tự
        kiểm tra, hoặc nhập lại save khác.
      </p>

      <div class="save-incompatible__actions">
        <GameButton variant="system" @click="handleExport">Tải Về Save (.json)</GameButton>

        <label class="save-incompatible__import">
          Nhập Save Khác
          <input type="file" accept="application/json" @change="handleImport" />
        </label>

        <GameButton variant="system" accent-var="var(--sys-danger)" @click="handleReset">Xoá & Bắt Đầu Mới</GameButton>
      </div>
    </SysPanel>

    <ConfirmModal
      :open="pendingConfirm !== null"
      :title="pendingConfirm?.title ?? ''"
      :message="pendingConfirm?.message ?? ''"
      :danger="pendingConfirm?.danger ?? false"
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
  background: var(--sys-bg-0, var(--ink-950));
}

.save-incompatible__panel {
  /* margin:auto — vẫn căn giữa khi vừa màn hình, nhưng khi overflow
     thì panel dạt lên trên để cuộn tới được toàn bộ nội dung. */
  margin: auto;
  max-width: 460px;
  padding: 28px 32px;
  text-align: center;
  font-family: var(--font-body);
}

.save-incompatible__title {
  margin: 0 0 12px;
  font-family: var(--sys-font-display, var(--font-display));
  color: var(--sys-accent, var(--paper-text));
  font-size: var(--text-title);
  font-weight: 700;
  letter-spacing: .08em;
}

.save-incompatible__message {
  margin: 0 0 20px;
  color: var(--sys-text-muted, var(--paper-text-soft));
  font-size: var(--text-sm);
  line-height: 1.5;
}

.save-incompatible__message strong {
  color: var(--sys-text, inherit);
  font-variant-numeric: tabular-nums;
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
  background: var(--sys-bg-0, var(--ink-800));
  color: var(--sys-text-muted, var(--text-primary));
  border: 1px solid var(--sys-line-soft, var(--ink-line));
  border-radius: 0;
  cursor: pointer;
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.save-incompatible__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.save-incompatible__import:hover {
  border-color: var(--sys-accent, var(--chrome-300));
  color: var(--sys-text, var(--chrome-100));
}
</style>

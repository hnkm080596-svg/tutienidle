<script setup lang="ts">
import { ref } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import { useSaveIssueStore } from '@/stores/saveIssue'
import { exportSaveToFile, deleteSave, importSaveRaw } from '@/services/save/SaveSystem'
import ConfirmModal from './ConfirmModal.vue'

const saveIssue = useSaveIssueStore()

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
      deleteSave()

      window.location.reload()
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
      requestConfirm('Nhập Save Thất Bại', 'File save không hợp lệ.', () => {})
    }
  }

  reader.readAsText(file)
}
</script>

<template>
  <div class="save-incompatible">
    <div class="save-incompatible__panel">
      <span class="ornate-frame" aria-hidden="true" />

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
        <GameButton variant="secondary" @click="handleExport">Tải Về Save (.json)</GameButton>

        <label class="save-incompatible__import">
          Nhập Save Khác
          <input type="file" accept="application/json" @change="handleImport" />
        </label>

        <GameButton variant="danger" @click="handleReset">Xoá & Bắt Đầu Mới</GameButton>
      </div>
    </div>

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
  z-index: 4000;
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
  margin: auto;
  max-width: 460px;
  padding: 28px 32px;
  background: linear-gradient(160deg, var(--ink-950), var(--ink-800));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.save-incompatible__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  color: var(--chrome-100);
  font-size: var(--text-title);
}

.save-incompatible__message {
  margin: 0 0 20px;
  color: var(--text-secondary);
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

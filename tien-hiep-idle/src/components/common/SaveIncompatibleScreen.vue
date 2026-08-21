<script setup lang="ts">
import { useSaveIssueStore } from '@/stores/saveIssue'
import { exportSaveToFile, deleteSave, importSaveRaw } from '@/services/save/SaveSystem'

const saveIssue = useSaveIssueStore()

function handleExport() {
  exportSaveToFile(saveIssue.raw)
}

function handleReset() {
  const confirmed = window.confirm(
    'Xoá save hiện tại và bắt đầu nhân vật mới? Nhớ Tải Về Save trước nếu chưa làm — hành động này không thể hoàn tác.',
  )

  if (!confirmed) {
    return
  }

  deleteSave()

  window.location.reload()
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
      window.alert('File save không hợp lệ.')
    }
  }

  reader.readAsText(file)
}
</script>

<template>
  <div class="save-incompatible">
    <div class="save-incompatible__panel">
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
        <button type="button" @click="handleExport">Tải Về Save (.json)</button>

        <label class="save-incompatible__import">
          Nhập Save Khác
          <input type="file" accept="application/json" @change="handleImport" />
        </label>

        <button type="button" class="save-incompatible__danger" @click="handleReset">
          Xoá & Bắt Đầu Mới
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-incompatible {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ink-950);
}

.save-incompatible__panel {
  max-width: 460px;
  padding: 28px 32px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.save-incompatible__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  color: var(--gold-500);
  font-size: 1.1rem;
}

.save-incompatible__message {
  margin: 0 0 20px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.5;
}

.save-incompatible__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.save-incompatible__actions button,
.save-incompatible__import {
  padding: 8px 18px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
}

.save-incompatible__import {
  position: relative;
  overflow: hidden;
}

.save-incompatible__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.save-incompatible__actions button:hover,
.save-incompatible__import:hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.save-incompatible__danger {
  border-color: var(--crimson);
  color: var(--crimson);
}

.save-incompatible__danger:hover {
  border-color: var(--crimson);
  color: var(--crimson);
  opacity: 0.85;
}
</style>

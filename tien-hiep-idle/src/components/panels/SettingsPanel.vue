<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, deleteSave } from '@/services/save/SaveSystem'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()

const lastSavedLabel = ref('')

function handleSave() {
  player.save(gameManager)

  lastSavedLabel.value = new Date().toLocaleTimeString()

  notification.push('save', 'Đã lưu tiến trình')
}

function handleLoad() {
  // GameManager.restoreFromSave() cộng dồn (materials/pills/talismans/
  // equipment dùng .add(), không clear trước) — gọi lại giữa phiên
  // đang chạy sẽ NHÂN ĐÔI tài nguyên thay vì thay thế. Reload tái
  // dùng đúng luồng onMounted() (đã đúng) thay vì phải viết clear()
  // cho từng Manager — rủi ro thấp hơn nhiều.
  const confirmed = window.confirm('Tải lại từ lần lưu gần nhất? Tiến trình chưa lưu sẽ mất.')

  if (confirmed) {
    window.location.reload()
  }
}

// Xuất save hiện tại — save() trước để file tải về phản ánh đúng
// tiến trình tại thời điểm bấm, không phải lần save gần nhất.
function handleExport() {
  player.save(gameManager)

  const raw = getRawSave()

  if (raw) {
    exportSaveToFile(raw)
  }
}

function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  input.value = ''

  if (!file) {
    return
  }

  const confirmed = window.confirm(
    'Nhập save này sẽ THAY THẾ tiến trình hiện tại (đã sao lưu 1 bản trước khi ghi đè). Tiếp tục?',
  )

  if (!confirmed) {
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

function handleReset() {
  const confirmed = window.confirm(
    'Xoá toàn bộ tiến trình và bắt đầu nhân vật mới? Nhớ "Xuất Save" trước nếu chưa làm — hành động này không thể hoàn tác.',
  )

  if (!confirmed) {
    return
  }

  deleteSave()

  window.location.reload()
}
</script>

<template>
  <div class="settings-panel">
    <h3>Cài Đặt</h3>

    <p class="settings-panel__warning">
      Tiến trình KHÔNG tự lưu — nhớ bấm "Lưu Tiến Trình" trước khi đóng trang.
    </p>

    <div class="settings-panel__actions">
      <button type="button" @click="handleSave">Lưu Tiến Trình</button>

      <button type="button" @click="handleLoad">Tải Lại (từ lần lưu gần nhất)</button>

      <button type="button" @click="handleExport">Xuất Save (.json)</button>

      <label class="settings-panel__import">
        Nhập Save
        <input type="file" accept="application/json" @change="handleImportFile" />
      </label>

      <button type="button" class="settings-panel__danger" @click="handleReset">
        Xoá Save & Bắt Đầu Mới
      </button>
    </div>

    <p v-if="lastSavedLabel" class="settings-panel__hint">Đã lưu lúc {{ lastSavedLabel }}</p>
  </div>
</template>

<style scoped>
.settings-panel {
  padding: 12px;
  color: #ddd;
  font-size: 0.85rem;
}

.settings-panel h3 {
  margin: 0 0 8px;
}

.settings-panel__warning {
  color: #ffb74d;
  border: 1px solid #4a3a1f;
  background: rgba(255, 183, 77, 0.08);
  border-radius: 4px;
  padding: 8px;
  margin: 0 0 12px;
}

.settings-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-panel__actions button,
.settings-panel__import {
  padding: 8px 14px;
}

.settings-panel__import {
  position: relative;
  overflow: hidden;
  text-align: center;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  background: #222;
  color: #ddd;
}

.settings-panel__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.settings-panel__danger {
  color: #e57373;
}

.settings-panel__hint {
  color: #8bc98b;
  margin: 8px 0 0;
}
</style>

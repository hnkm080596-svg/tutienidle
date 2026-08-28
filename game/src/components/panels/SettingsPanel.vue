<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()

// WS8 — cỡ chữ giao diện (chỉ scale semantic tokens, không zoom canvas).
const uiScale = ref<number>(loadUiScale())

function handleUiScale(scale: number) {
  uiScale.value = scale
  saveUiScale(scale)
}

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

  // App phải dừng interval/pagehide autosave TRƯỚC khi xóa; nếu panel tự xóa
  // rồi reload, pagehide ghi lại chính save vừa xóa.
  window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT))
}
</script>

<template>
  <div class="settings-panel">
    <h3>Cài Đặt</h3>

    <p class="settings-panel__warning">
      Tiến trình tự lưu mỗi 15 giây và khi rời tab. Bạn vẫn có thể lưu thủ công tại đây.
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

    <!-- WS8 — cỡ chữ giao diện: chỉ scale typography/control tokens,
         không đụng canvas/khung layout. Áp dụng tức thời + lưu local. -->
    <section class="settings-panel__ui-scale" aria-label="Cỡ chữ giao diện">
      <h4>Cỡ Chữ Giao Diện</h4>

      <div class="settings-panel__ui-scale-options">
        <button
          v-for="option in UI_SCALE_OPTIONS"
          :key="option"
          type="button"
          :class="{ 'is-active': uiScale === option }"
          @click="handleUiScale(option)"
        >
          {{ Math.round(option * 100) }}%
        </button>
      </div>
    </section>

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

/* WS8 — chọn cỡ chữ giao diện. */
.settings-panel__ui-scale {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.settings-panel__ui-scale h4 {
  margin: 0 0 8px;
}

.settings-panel__ui-scale-options {
  display: flex;
  gap: var(--space-2);
}

.settings-panel__ui-scale-options button {
  min-height: var(--tap-min);
  padding: 0 var(--space-4);
  background: #222;
  border: 1px solid #444;
  border-radius: var(--radius-sm);
  color: #ddd;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.settings-panel__ui-scale-options button:hover {
  border-color: var(--gold-700);
}

.settings-panel__ui-scale-options button.is-active {
  background: rgba(255, 213, 79, 0.12);
  border-color: var(--gold-500);
  color: var(--gold-300);
}

.settings-panel__ui-scale-options button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
}
</style>

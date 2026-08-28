<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()

// Thay window.confirm() native — modal xác nhận đồng bộ hoá bằng
// pending-action: mở ConfirmModal, hành động thật chỉ chạy khi
// resolvePendingConfirm() (nút "Xác Nhận") được gọi.
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
  requestConfirm(
    'Tải Lại',
    'Tải lại từ lần lưu gần nhất? Tiến trình chưa lưu sẽ mất.',
    () => window.location.reload(),
  )
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

  requestConfirm(
    'Nhập Save',
    'Nhập save này sẽ THAY THẾ tiến trình hiện tại (đã sao lưu 1 bản trước khi ghi đè). Tiếp tục?',
    () => {
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
    },
  )
}

function handleReset() {
  requestConfirm(
    'Xoá Save',
    'Xoá toàn bộ tiến trình và bắt đầu nhân vật mới? Nhớ "Xuất Save" trước nếu chưa làm — hành động này không thể hoàn tác.',
    // App phải dừng interval/pagehide autosave TRƯỚC khi xóa; nếu panel tự xóa
    // rồi reload, pagehide ghi lại chính save vừa xóa.
    () => window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT)),
    true,
  )
}
</script>

<template>
  <div class="settings-panel">
    <p class="settings-panel__warning">
      Tiến trình tự lưu mỗi 15 giây và khi rời tab. Bạn vẫn có thể lưu thủ công tại đây.
    </p>

    <div class="settings-panel__actions">
      <GameButton variant="secondary" @click="handleSave">Lưu Tiến Trình</GameButton>

      <GameButton variant="secondary" @click="handleLoad">Tải Lại (từ lần lưu gần nhất)</GameButton>

      <GameButton variant="secondary" @click="handleExport">Xuất Save (.json)</GameButton>

      <label class="settings-panel__import">
        Nhập Save
        <input type="file" accept="application/json" @change="handleImportFile" />
      </label>

      <GameButton class="settings-panel__danger" variant="danger" @click="handleReset">
        Xoá Save & Bắt Đầu Mới
      </GameButton>
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
.settings-panel {
  padding: 12px;
  color: var(--text-primary);
  font-size: var(--text-body);
}

.settings-panel__warning {
  color: var(--chrome-100);
  border: 1px solid var(--ink-line);
  background: color-mix(in srgb, var(--chrome-500) 8%, transparent);
  border-radius: var(--radius-sm);
  padding: 8px;
  margin: 0 0 12px;
}

.settings-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-panel__import {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap-min);
  padding: 8px 14px;
  overflow: hidden;
  text-align: center;
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--ink-800);
  color: var(--text-primary);
}

.settings-panel__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.settings-panel__hint {
  color: var(--jade);
  margin: 8px 0 0;
}

/* WS8 — chọn cỡ chữ giao diện. */
.settings-panel__ui-scale {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--ink-line-soft);
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
  background: var(--ink-800);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.settings-panel__ui-scale-options button:hover {
  border-color: var(--chrome-500);
}

.settings-panel__ui-scale-options button.is-active {
  background: color-mix(in srgb, var(--chrome-300) 12%, transparent);
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}

.settings-panel__ui-scale-options button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-chrome);
}
</style>

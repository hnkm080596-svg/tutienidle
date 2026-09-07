<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'
import ThemeSwitcher from '@/components/settings/ThemeSwitcher.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()
const { t } = useI18n({ useScope: 'local' })

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

// Lưu thủ công phải await và kiểm tra kết quả — trước đây toast
// "Đã lưu tiến trình" hiện cả khi writeGameSave fail (quota), người
// chơi tưởng tiến trình đã an toàn rồi đóng tab mất trắng.
async function handleSave() {
  const result = await player.save(gameManager)

  if (result.status === 'ok') {
    lastSavedLabel.value = new Date().toLocaleTimeString('vi-VN')

    notification.push('save', t('panels.settings.notifications.saved'))
  } else {
    lastSavedLabel.value = t('panels.settings.notifications.saveFailedShort')

    // Audit fix 2026-08-31 — kind 'error' (đỏ) đồng nhất App.vue autosave
    // fail; kind 'save' (xanh nhạt) làm người chơi bỏ qua mất nguy cơ.
    notification.push('error', t('panels.settings.notifications.saveFailed'))
  }
}

function handleLoad() {
  // GameManager.restoreFromSave() cộng dồn (materials/pills/talismans/
  // equipment dùng .add(), không clear trước) — gọi lại giữa phiên
  // đang chạy sẽ NHÂN ĐÔI tài nguyên thay vì thay thế. Reload tái
  // dùng đúng luồng onMounted() (đã đúng) thay vì phải viết clear()
  // cho từng Manager — rủi ro thấp hơn nhiều.
  requestConfirm(
    t('panels.settings.confirm.reloadTitle'),
    t('panels.settings.confirm.reloadBody'),
    () => window.location.reload(),
  )
}

// Xuất save hiện tại — save() trước để file tải về phản ánh đúng
// tiến trình tại thời điểm bấm, không phải lần save gần nhất.
async function handleExport() {
  // PHẢI await — writeGameSave chạy trong microtask (cloudSaveCoordinator
  // → LocalCloudSaveService.save đều async); đọc localStorage ngay sau lời
  // gọi sync sẽ lấy save 15s cũ (bug audit 2026-08-31).
  const result = await player.save(gameManager)

  if (result.status !== 'ok') {
    notification.push('error', t('panels.settings.notifications.exportFailed'))
    return
  }

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
    t('panels.settings.confirm.importTitle'),
    t('panels.settings.confirm.importBody'),
    () => {
      const reader = new FileReader()

      reader.onload = () => {
        const ok = importSaveRaw(String(reader.result))

        if (ok) {
          window.location.reload()
        } else {
          // UI-007 (Task 5) — window.alert native → toast store (in-game
          // feedback, tự biến mất, không chặn luồng; giữ import input
          // reset để retry ngay).
          notification.push('error', t('panels.settings.errors.invalidSaveFile'))
        }
      }

      reader.readAsText(file)
    },
  )
}

function handleReset() {
  requestConfirm(
    t('panels.settings.confirm.resetTitle'),
    t('panels.settings.confirm.resetBody'),
    // App phải dừng interval/pagehide autosave TRƯỚC khi xoá; nếu panel tự
    // reload, pagehide ghi lại chính save vừa xoá.
    () => window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT)),
    true,
  )
}
</script>

<template>
  <div class="settings-panel">
    <p class="settings-panel__warning">
      {{ t('panels.settings.autosaveNote') }}
    </p>

    <div class="settings-panel__actions">
      <GameButton variant="secondary" data-testid="settings-save-button" @click="handleSave">{{ t('panels.settings.actions.save') }}</GameButton>

      <GameButton variant="secondary" @click="handleLoad">{{ t('panels.settings.actions.reload') }}</GameButton>

      <GameButton variant="secondary" @click="handleExport">{{ t('panels.settings.actions.export') }}</GameButton>

      <label class="settings-panel__import">
        {{ t('panels.settings.actions.import') }}
        <input type="file" accept="application/json" @change="handleImportFile" />
      </label>

      <GameButton class="settings-panel__danger" variant="danger" @click="handleReset">
        {{ t('panels.settings.actions.reset') }}
      </GameButton>
    </div>

    <!-- WS8 — cỡ chữ giao diện: chỉ scale typography/control tokens,
         không đụng canvas/khung layout. Áp dụng tức thời + lưu local. -->
    <section class="settings-panel__ui-scale" :aria-label="t('panels.settings.sections.uiScaleAria')">
      <h4>{{ t('panels.settings.sections.uiScale') }}</h4>

      <div class="settings-panel__ui-scale-options">
        <Chip
          v-for="option in UI_SCALE_OPTIONS"
          :key="option"
          class="settings-panel__ui-scale-option"
          :active="uiScale === option"
          @click="handleUiScale(option)"
        >
          {{ Math.round(option * 100) }}%
        </Chip>
      </div>
    </section>

    <!-- Giao diện — chọn theme (ThemeSwitcher quản lý useTheme + preview card). -->
    <section class="settings-panel__theme" :aria-label="t('panels.settings.sections.themeAria')">
      <h4>{{ t('panels.settings.sections.theme') }}</h4>
      <ThemeSwitcher />
    </section>

    <p v-if="lastSavedLabel" class="settings-panel__hint">{{ t('panels.settings.hints.savedAt', { time: lastSavedLabel }) }}</p>

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
  color: var(--paper-text);
  font-size: var(--text-body);
}

.settings-panel__warning {
  color: var(--paper-text-soft);
  border: 1px solid var(--paper-line);
  background: color-mix(in srgb, var(--paper-100) 45%, transparent);
  border-radius: 2px;
  padding: 8px;
  margin: 0 0 12px;
}

.settings-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  max-width: 360px;
  padding: 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-100) 35%, transparent);
}

.settings-panel__actions > .game-button,
.settings-panel__actions > .settings-panel__import {
  width: 100%;
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
  border-top: 1px solid var(--paper-line);
}

.settings-panel__ui-scale h4 {
  margin: 0 0 8px;
}

.settings-panel__ui-scale-options {
  display: flex;
  gap: var(--space-2);
}

.settings-panel__ui-scale-option {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}

.settings-panel__ui-scale-option:hover {
  border-color: var(--chrome-500);
}

/* Task 5.6 — chọn theme giao diện (ThemeSwitcher). */
.settings-panel__theme {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--paper-line);
}

.settings-panel__theme h4 {
  margin: 0 0 8px;
  color: var(--paper-text);
}
</style>

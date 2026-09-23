<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useAudioStore } from '@/stores/audio'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'
import { loadSysFxLow, saveSysFxLow } from '@/composables/sysFxMode'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()
const audio = useAudioStore()
const { t } = useI18n()

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

// M-UI-OVERHAUL - low-effects toggle (documentElement.sys-fx-low).
const fxLow = ref<boolean>(loadSysFxLow())

function handleFxLow(low: boolean) {
  fxLow.value = low
  saveSysFxLow(low)
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

    <!-- M-UI-OVERHAUL - system effects on/off (rim sweeps, scanlines, boot wipes). -->
    <section class="settings-panel__fx" :aria-label="t('panels.settings.sections.effectsAria')">
      <h4>{{ t('panels.settings.sections.effects') }}</h4>
      <Chip
        class="settings-panel__fx-toggle"
        :active="fxLow"
        :aria-pressed="fxLow"
        data-testid="settings-fx-low-toggle"
        @click="handleFxLow(!fxLow)"
      >
        {{ fxLow ? t('panels.settings.audio.on') : t('panels.settings.audio.off') }}
      </Chip>
    </section>

    <!-- Audio — on/off + master volume (0-100%). Persisted via useAudioStore. -->
    <section class="settings-panel__audio" :aria-label="t('panels.settings.sections.audioAria')">
      <h4>{{ t('panels.settings.sections.audio') }}</h4>

      <div class="settings-panel__audio-row">
        <Chip
          class="settings-panel__audio-toggle"
          :active="audio.enabled"
          :aria-pressed="audio.enabled"
          data-testid="settings-audio-toggle"
          @click="audio.setEnabled(!audio.enabled)"
        >
          {{ audio.enabled ? t('panels.settings.audio.on') : t('panels.settings.audio.off') }}
        </Chip>

        <label class="settings-panel__audio-volume">
          {{ t('panels.settings.audio.volume') }}
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(audio.masterVolume * 100)"
            :disabled="!audio.enabled"
            data-testid="settings-audio-volume"
            @input="audio.setMasterVolume(Number(($event.target as HTMLInputElement).value) / 100)"
          />
          <span class="settings-panel__audio-volume-value">{{ Math.round(audio.masterVolume * 100) }}%</span>
        </label>
      </div>
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
  color: var(--sys-text, var(--paper-text));
  font-size: var(--text-body);
}

.settings-panel__warning {
  color: var(--sys-text-muted, var(--paper-text-soft));
  border: 1px solid var(--sys-line-soft, var(--paper-line));
  background: color-mix(in srgb, var(--sys-bg-1, var(--paper-100)) 45%, transparent);
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
  border: 1px solid var(--sys-line-soft, var(--paper-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--sys-bg-1, var(--paper-100)) 35%, transparent);
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
  border: 1px solid var(--sys-line, var(--ink-line));
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--sys-bg-0, var(--ink-800));
  color: var(--sys-text, var(--text-primary));
}

.settings-panel__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.settings-panel__hint {
  color: var(--sys-success, var(--jade));
  margin: 8px 0 0;
}

/* WS8 — chọn cỡ chữ giao diện. */
.settings-panel__ui-scale {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--sys-line-soft, var(--paper-line));
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
  border-color: var(--sys-line-soft, var(--paper-line));
  color: var(--sys-text, var(--paper-text));
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--sys-text, var(--chrome-300)) 12%, transparent);
}

.settings-panel__ui-scale-option:hover {
  border-color: var(--sys-line, var(--chrome-500));
}

/* M-UI-OVERHAUL - low-effects toggle mirrors the ui-scale/audio sections. */
.settings-panel__fx {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--sys-line-soft, var(--paper-line));
}

.settings-panel__fx h4 {
  margin: 0 0 8px;
}

.settings-panel__fx-toggle {
  padding: 0 var(--space-4);
  border-color: var(--sys-line-soft, var(--paper-line));
  color: var(--sys-text, var(--paper-text));
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--sys-accent, var(--mineral-gold)) 16%, transparent);
}

/* Audio — on/off + master volume. */
.settings-panel__audio {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--sys-line-soft, var(--paper-line));
}

.settings-panel__audio h4 {
  margin: 0 0 8px;
  color: var(--sys-text, var(--paper-text));
}

.settings-panel__audio-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.settings-panel__audio-toggle {
  padding: 0 var(--space-4);
  border-color: var(--sys-line-soft, var(--paper-line));
  color: var(--sys-text, var(--paper-text));
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--sys-text, var(--chrome-300)) 12%, transparent);
}

.settings-panel__audio-volume {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--sys-text, var(--paper-text));
}

.settings-panel__audio-volume input[type='range'] {
  width: 140px;
  accent-color: var(--sys-accent, var(--gold));
}

.settings-panel__audio-volume-value {
  min-width: 3ch;
  text-align: right;
  color: var(--sys-text-muted, var(--paper-text-soft));
}
</style>

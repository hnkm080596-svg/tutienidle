<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useAudioStore } from '@/stores/audio'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()
const audio = useAudioStore()

// W3: one slider per audio channel (field = store state, channel = bus id).
const AUDIO_CHANNELS = [
  { field: 'musicVolume', channel: 'music', labelKey: 'musicVolume' },
  { field: 'sfxVolume', channel: 'sfx', labelKey: 'sfxVolume' },
  { field: 'uiVolume', channel: 'ui', labelKey: 'uiVolume' },
] as const
const { t } = useI18n()

// Thay window.confirm() native - modal xac nhan ong bo hoa bang
// pending-action: mo ConfirmModal, hanh ong that chi chay khi
// resolvePendingConfirm() (nut "Xac Nhan") uoc goi.
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

// WS8 - co chu giao dien (chi scale semantic tokens, khong zoom canvas).
const uiScale = ref<number>(loadUiScale())

function handleUiScale(scale: number) {
  uiScale.value = scale
  saveUiScale(scale)
}

const lastSavedLabel = ref('')

// Luu thu cong phai await va kiem tra ket qua - truoc ay toast
// "a luu tien trinh" hien ca khi writeGameSave fail (quota), nguoi
// choi tuong tien trinh a an toan roi ong tab mat trang.
async function handleSave() {
  const result = await player.save(gameManager)

  if (result.status === 'ok') {
    lastSavedLabel.value = new Date().toLocaleTimeString('vi-VN')

    notification.push('save', t('panels.settings.notifications.saved'))
  } else {
    lastSavedLabel.value = t('panels.settings.notifications.saveFailedShort')

    // Audit fix 2026-08-31 - kind 'error' (o) ong nhat App.vue autosave
    // fail; kind 'save' (xanh nhat) lam nguoi choi bo qua mat nguy co.
    notification.push('error', t('panels.settings.notifications.saveFailed'))
  }
}

function handleLoad() {
  // GameManager.restoreFromSave() cong don (materials/pills/talismans/
  // equipment dung .add(), khong clear truoc) - goi lai giua phien
  // ang chay se NHAN OI tai nguyen thay vi thay the. Reload tai
  // dung ung luong onMounted() (a ung) thay vi phai viet clear()
  // cho tung Manager - rui ro thap hon nhieu.
  requestConfirm(
    t('panels.settings.confirm.reloadTitle'),
    t('panels.settings.confirm.reloadBody'),
    () => window.location.reload(),
  )
}

// Xuat save hien tai - save() truoc e file tai ve phan anh ung
// tien trinh tai thoi iem bam, khong phai lan save gan nhat.
async function handleExport() {
  // PHAI await - writeGameSave chay trong microtask (cloudSaveCoordinator
  // -> LocalCloudSaveService.save eu async); oc localStorage ngay sau loi
  // goi sync se lay save 15s cu (bug audit 2026-08-31).
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
          // UI-007 (Task 5) - window.alert native -> toast store (in-game
          // feedback, tu bien mat, khong chan luong; giu import input
          // reset e retry ngay).
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
    // App phai dung interval/pagehide autosave TRUOC khi xoa; neu panel tu
    // reload, pagehide ghi lai chinh save vua xoa.
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

    <!-- WS8 - co chu giao dien: chi scale typography/control tokens,
         khong ung canvas/khung layout. Ap dung tuc thoi + luu local. -->
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

    <!-- Audio - on/off + master/channel volumes (0-100%) + reduced shake. Persisted via useAudioStore. -->
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

      <div class="settings-panel__audio-row">
        <label
          v-for="channel in AUDIO_CHANNELS"
          :key="channel.field"
          class="settings-panel__audio-volume"
        >
          {{ t(`panels.settings.audio.${channel.labelKey}`) }}
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(audio[channel.field] * 100)"
            :disabled="!audio.enabled"
            :data-testid="`settings-audio-${channel.field}`"
            @input="audio.setChannelVolume(channel.channel, Number(($event.target as HTMLInputElement).value) / 100)"
          />
          <span class="settings-panel__audio-volume-value">{{ Math.round(audio[channel.field] * 100) }}%</span>
        </label>
      </div>

      <div class="settings-panel__audio-row">
        <Chip
          class="settings-panel__audio-toggle"
          :active="audio.reducedShake"
          :aria-pressed="audio.reducedShake"
          data-testid="settings-reduced-shake"
          @click="audio.setReducedShake(!audio.reducedShake)"
        >
          {{ t('panels.settings.audio.reducedShake') }}
        </Chip>
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

/* Audio — on/off + master volume. */
.settings-panel__audio {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--paper-line);
}

.settings-panel__audio h4 {
  margin: 0 0 8px;
  color: var(--paper-text);
}

.settings-panel__audio-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.settings-panel__audio-toggle {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}

.settings-panel__audio-volume {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--paper-text);
}

.settings-panel__audio-volume input[type='range'] {
  width: 140px;
  accent-color: var(--gold);
}

.settings-panel__audio-volume-value {
  min-width: 3ch;
  text-align: right;
  color: var(--paper-text-soft);
}
</style>

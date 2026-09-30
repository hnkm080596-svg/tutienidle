<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useAudioStore } from '@/stores/audio'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { validateRecoveryData } from '@/services/save/recoveryApi'
import { cloudSaveCoordinator } from '@/services/cloudSave/CloudSaveServiceFactory'
import { observeAuthoritySaveResult } from '@/composables/useOnlineAuthority'
import { UI_SCALE_OPTIONS, loadUiScale, saveUiScale } from '@/composables/uiScale'
import { LOCALE_OPTIONS, saveLocale, type AppLocale } from '@/composables/locale'
import { BUILD_IDENTITY, shortGitSha } from '@/shared/build/BuildIdentity'
import { useActiveUpdates } from '@/composables/useUpdates'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()
const audio = useAudioStore()
const { t, locale } = useI18n()

// B1.9a - under the remote authority the panel's recovery actions keep
// different semantics: manual import validates/exports the file instead
// of overwriting (no client-side path can replace the cloud row), reset
// clears the local cache so the authoritative load restores from cloud,
// and export stamps its provenance + revision onto the filename.
const remoteAuthoritative = cloudSaveCoordinator.capability === 'remote-authoritative'

// W3: one slider per audio channel (field = store state, channel = bus id).
const AUDIO_CHANNELS = [
  { field: 'musicVolume', channel: 'music', labelKey: 'musicVolume' },
  { field: 'sfxVolume', channel: 'sfx', labelKey: 'sfxVolume' },
  { field: 'uiVolume', channel: 'ui', labelKey: 'uiVolume' },
] as const

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

function handleLocale(next: AppLocale) {
  saveLocale(next)
}

// BETA-FINAL PR1 - one read of the injected build identity for the Build
// section below (frozen; same literal the Electron main process logged).
const build = BUILD_IDENTITY
const BUILD_ROWS = [
  { labelKey: 'version', testid: 'build-version', value: build.appVersion },
  { labelKey: 'build', testid: 'build-id', value: build.buildId },
  { labelKey: 'commit', testid: 'build-commit', value: shortGitSha() },
  { labelKey: 'schema', testid: 'build-schema', value: build.saveSchemaVersion },
  { labelKey: 'environment', testid: 'build-environment', value: build.backendEnvironment },
  { labelKey: 'channel', testid: 'build-channel', value: build.releaseChannel },
  { labelKey: 'builtAt', testid: 'build-built-at', value: build.builtAtUtc },
] as const

const lastSavedLabel = ref('')

// BETA-FINAL PR12 - the bound update surface (null on web builds; the
// section hides itself then). Renders the sanitized UpdateState only.
const updates = useActiveUpdates()
const updateState = computed(() => updates?.state.value ?? null)
const updatePhase = computed(() => updateState.value?.phase ?? null)
const updateProgressPercent = computed(() => Math.round(updateState.value?.progress?.percent ?? 0))

// Lưu thủ công phải await và kiểm tra kết quả — trước đây toast
// "Đã lưu tiến trình" hiện cả khi writeGameSave fail (quota), người
// chơi tưởng tiến trình đã an toàn rồi đóng tab mất trắng.
async function handleSave() {
  const result = await player.save(gameManager)

  // B1-D: every save outcome reports to the admission authority (remote
  // mode only - the call is a no-op when no remote session is bound).
  observeAuthoritySaveResult(result)

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

  observeAuthoritySaveResult(result)

  if (result.status !== 'ok') {
    notification.push('error', t('panels.settings.notifications.exportFailed'))
    return
  }

  // B1-C: remote mode exports the server-ACKed envelope (payload +
  // revision bound as one identity); local mode's slot is the same
  // facade. getRawSave stays as a legacy fallback only.
  const cached = await cloudSaveCoordinator.readCachedSave()
  const raw = cached?.raw ?? getRawSave()

  if (raw) {
    exportSaveToFile(
      raw,
      remoteAuthoritative
        ? { source: 'cloud', revision: cached?.revision ?? cloudSaveCoordinator.getRevision() }
        : { source: 'local', revision: cached?.revision ?? cloudSaveCoordinator.getRevision() },
    )
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
    remoteAuthoritative
      ? t('panels.settings.confirm.importBodyRemote')
      : t('panels.settings.confirm.importBody'),
    () => {
      const reader = new FileReader()

      reader.onload = () => {
        const rawText = String(reader.result)

        if (remoteAuthoritative) {
          // Remote mode: validate the recovery file only. A consumable
          // payload is exported back normalized (identified by source +
          // revision); the cloud row and the local cache stay untouched.
          const validation = validateRecoveryData(rawText)

          if (validation.status === 'valid') {
            exportSaveToFile(validation.normalizedRaw, { source: 'recovery-import' })
            notification.push('save', t('panels.settings.notifications.importValidatedRemote'))
          } else {
            notification.push('error', t('panels.settings.errors.invalidSaveFile'))
          }

          return
        }

        const ok = importSaveRaw(rawText)

        if (ok) {
          window.location.reload()
        } else {
          // UI-007 (Task 5) - window.alert native -> toast store (in-game
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
    remoteAuthoritative
      ? t('panels.settings.confirm.resetCloudTitle')
      : t('panels.settings.confirm.resetTitle'),
    remoteAuthoritative
      ? t('panels.settings.confirm.resetCloudBody')
      : t('panels.settings.confirm.resetBody'),
    // App phải dừng interval/pagehide autosave TRƯỚC khi xoá; nếu panel tự
    // reload, pagehide ghi lại chính save vừa xoá.
    () => window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT)),
    true,
  )
}
</script>

<template>
  <div class="settings-panel paper-on-dark">
    <p class="settings-panel__warning">
      {{ t('panels.settings.autosaveNote') }}
    </p>

    <!-- Sectioned grid (ui-audit creation-meta): the actions column was
         a lone 360px strip inside a min(1120px) overlay - group the four
         setting clusters into equal cards that fill the space. -->
    <div class="settings-panel__grid">
      <section class="settings-panel__section" :aria-label="t('panels.settings.sections.saveAria')">
        <h4>{{ t('panels.settings.sections.save') }}</h4>

        <div class="settings-panel__actions">
          <GameButton variant="secondary" data-testid="settings-save-button" @click="handleSave">{{ t('panels.settings.actions.save') }}</GameButton>

          <GameButton variant="secondary" @click="handleLoad">{{ t('panels.settings.actions.reload') }}</GameButton>

          <GameButton variant="secondary" @click="handleExport">{{ t('panels.settings.actions.export') }}</GameButton>

          <label class="settings-panel__import">
            {{ t('panels.settings.actions.import') }}
            <input type="file" accept="application/json" @change="handleImportFile" />
          </label>

          <GameButton class="settings-panel__danger" variant="danger" @click="handleReset">
            {{ remoteAuthoritative ? t('panels.settings.actions.resetCloud') : t('panels.settings.actions.reset') }}
          </GameButton>
        </div>
      </section>

    <!-- WS8 — cỡ chữ giao diện: chỉ scale typography/control tokens,
         không đụng canvas/khung layout. Áp dụng tức thời + lưu local. -->
    <section class="settings-panel__section settings-panel__ui-scale" :aria-label="t('panels.settings.sections.uiScaleAria')">
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
    <section class="settings-panel__section settings-panel__audio" :aria-label="t('panels.settings.sections.audioAria')">
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

    <!-- Language - UI locale, persisted via composables/locale. -->
    <section class="settings-panel__section settings-panel__language" :aria-label="t('panels.settings.sections.languageAria')">
      <h4>{{ t('panels.settings.sections.language') }}</h4>

      <p class="settings-panel__section-note">{{ t('panels.settings.language.note') }}</p>

      <div class="settings-panel__language-options">
        <Chip
          v-for="option in LOCALE_OPTIONS"
          :key="option"
          class="settings-panel__language-option"
          :active="locale === option"
          :data-testid="`settings-locale-${option}`"
          @click="handleLocale(option)"
        >
          {{ t(`panels.settings.language.names.${option}`) }}
        </Chip>
      </div>
    </section>

    <!-- BETA-FINAL PR12 / spec B6 - the update surface. Hidden entirely
         on builds with no verified feed (web/dev render 'unsupported' -
         there is nothing honest to offer). -->
    <section
      v-if="updateState !== null && updatePhase !== 'unsupported'"
      class="settings-panel__section settings-panel__update"
      :aria-label="t('panels.settings.sections.updateAria')"
    >
      <h4>{{ t('panels.settings.update.title') }}</h4>

      <p class="settings-panel__section-note">
        {{ t('panels.settings.update.note', { version: updateState.currentVersion }) }}
      </p>

      <p v-if="updatePhase === 'available'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('panels.settings.update.statusAvailable', { version: updateState.candidate?.version }) }}
      </p>
      <p v-else-if="updatePhase === 'downloading'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('updates.downloading', { percent: updateProgressPercent }) }}
      </p>
      <p v-else-if="updatePhase === 'downloaded'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('updates.ready', { version: updateState.candidate?.version }) }}
      </p>
      <p v-else-if="updatePhase === 'checking'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('panels.settings.update.statusChecking') }}
      </p>
      <p v-else-if="updatePhase === 'unavailable'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('panels.settings.update.statusUpToDate') }}
      </p>
      <p v-else-if="updatePhase === 'error'" class="settings-panel__update-status" data-testid="update-status">
        {{ t('updates.failed') }}
      </p>

      <div class="settings-panel__actions">
        <GameButton
          v-if="updatePhase === 'available'"
          size="md"
          variant="primary"
          data-testid="update-download"
          @click="updates?.download()"
        >
          {{ t('updates.download') }}
        </GameButton>
        <GameButton
          v-else-if="updatePhase === 'downloading'"
          size="md"
          variant="secondary"
          data-testid="update-cancel"
          @click="updates?.cancelDownload()"
        >
          {{ t('updates.cancel') }}
        </GameButton>
        <GameButton
          v-else-if="updatePhase === 'downloaded'"
          size="md"
          variant="primary"
          data-testid="update-install"
          @click="updates?.install()"
        >
          {{ t('updates.install') }}
        </GameButton>
        <GameButton
          v-else
          size="md"
          variant="secondary"
          :disabled="updatePhase === 'checking' || updatePhase === 'installing'"
          data-testid="update-check"
          @click="updates?.check()"
        >
          {{ t('updates.check') }}
        </GameButton>
      </div>
    </section>

    <!-- BETA-FINAL PR1 / spec B2 - support-visible build identity. Values
         match the release manifest and the error screen footer. -->
    <section class="settings-panel__section settings-panel__build" :aria-label="t('panels.settings.sections.buildAria')">
      <h4>{{ t('panels.settings.sections.build') }}</h4>

      <dl class="settings-panel__build-list">
        <div v-for="row in BUILD_ROWS" :key="row.testid" class="settings-panel__build-row">
          <dt>{{ t(`panels.settings.build.${row.labelKey}`) }}</dt>
          <dd :data-testid="row.testid">{{ row.value }}</dd>
        </div>
      </dl>
    </section>
    </div>

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

.settings-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  align-items: start;
}

.settings-panel__section {
  padding: 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-100) 35%, transparent);
}

.settings-panel__section h4 {
  margin: 0 0 10px;
  color: var(--paper-text);
  font-family: var(--font-display);
  font-size: var(--text-md);
  letter-spacing: 0.05em;
}

.settings-panel__section-note {
  margin: 0 0 10px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.settings-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
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

/* Audio - on/off + master volume. */
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

/* Language - chip row in the same rhythm as ui-scale options. */
.settings-panel__language-options {
  display: flex;
  gap: var(--space-2);
}

.settings-panel__language-option {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}

.settings-panel__language-option:hover {
  border-color: var(--chrome-500);
}

/* Build identity - read-only dl for support/diagnostics. */
.settings-panel__build-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-xs);
}

.settings-panel__build-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.settings-panel__build-row dt {
  color: var(--paper-text-soft);
}

.settings-panel__build-row dd {
  margin: 0;
  color: var(--paper-text);
  font-family: var(--font-mono, monospace);
  word-break: break-all;
  text-align: right;
}
</style>
